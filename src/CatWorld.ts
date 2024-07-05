import { Engine, Render, Composite, Bodies, Runner, World, Vector, Vertices, Events, Constraint, Body, Query, Bounds } from 'matter-js';
// @ts-ignore No types ...
import Color from 'color';
import { Portal } from './Portal';
import { Member, ThingData } from './Client';
import { Util } from './util/Util';

export interface CatWorldConfig {
	catScale: number;
	catBounce: number;
	catCount: number;
}

export interface Cat {
	name: string;
	img: string;
	path: Vector[];
	scale: number;
	bounce: number;
}

interface DragPoint {
	position: Vector;
	id: number;
}

interface DragConstraint {
	constraint: Constraint|null;
	id: number;
}

export class CatWorld {

	private static readonly WALL_LAYER: number = 0x001;
	private static readonly CAT_LAYER: number = 0x002;

	private static cats: Cat[] = [];

	private engine!: Engine;
	private renderer!: Render;
	private border: Body[] = [];
	private maxYPosition: number = 5000;

	private portals: Portal[] = [];
	private cats: Map<number, Body> = new Map();
	private teleportBlacklist: Map<number, Body> = new Map();

	public catScale: number = .5;
	public catBounce: number = 1.4;
	public background: Color;

	public get bounds(): Bounds {
		return {
			min: Vector.create(0, 0),
			max: Vector.create(window.innerWidth, window.innerHeight)
		};
	}

	constructor(config?: Partial<CatWorldConfig>) {
		Object.assign(this, config ?? {});

		this.background = Color({
			r: Math.floor(Math.random() * 255),
			g: Math.floor(Math.random() * 255),
			b: Math.floor(Math.random() * 255)
		});

		this.initWorld();
		this.initMouseEvents();
		this.initEvents();
		this.initGyro();
	}

	static async init() {
		const response = await fetch('assets/cats.json');
		CatWorld.cats = await response.json() as Cat[];

		for (const cat of CatWorld.cats) {
			cat.img = `./assets/${cat.name}.png`;
			cat.scale = 1;
			cat.bounce = 1;
		}
	}

	private initWorld() {
		const engine = Engine.create();
		const runner = Runner.create();
		const renderer = Render.create({
			element: document.body,
			engine: engine,
			options: {
				width: window.innerWidth,
				height: window.innerHeight,
				wireframes: false,
				background: `linear-gradient(to bottom, ${this.background.hex()}, ${this.background.darken(.7).hex()})`
			},
			textures: CatWorld.cats.map(cat => cat.img)
		});

		Render.run(renderer);
		Runner.run(runner, engine);

		Events.on(engine, 'beforeUpdate', _evt => {
			for (const body of engine.world.bodies) {
				if (body.position.y > this.maxYPosition) {
					const xPos = Math.floor(Math.random() * window.innerWidth - 200) + 100;
					Body.setPosition(body, Vector.create(xPos, -500));
					Body.setVelocity(body, Vector.div(body.velocity, 10));
				}
			}
		});

		const getBodies = (pair: Matter.Pair): {
			portal: Body,
			cat: Body
		}|null => {
			const aIsPortal = pair.bodyA.label === Portal.LABEL;
			const bIsPortal = pair.bodyB.label === Portal.LABEL;
			if (!aIsPortal && !bIsPortal) {
				return null;
			}

			return {
				portal: aIsPortal ? pair.bodyA : pair.bodyB,
				cat: aIsPortal ? pair.bodyB : pair.bodyA
			};
		};

		Events.on(engine, 'collisionStart', evt => {
			for (const pair of evt.pairs) {
				const bodies = getBodies(pair);
				if (!bodies || !this.cats.has(bodies.cat.id)) {
					continue;
				}

				// teleport and remove cat
				const portal = bodies.portal.plugin as Portal;
				if (!this.teleportBlacklist.has(bodies.cat.id)) {
					portal.teleport(bodies.cat);
					this.removeCat(bodies.cat);
				}
			}
		});

		Events.on(engine, 'collisionEnd', evt => {
			for (const pair of evt.pairs) {
				const bodies = getBodies(pair);
				if (!bodies) {
					continue;
				}

				this.teleportBlacklist.delete(bodies.cat.id);
			}
		});

		this.engine = engine;
		this.renderer = renderer;

		this.updateBorder();
	}

	private initMouseEvents() {
		const world = this.engine.world;
		const settings = document.getElementById('settings');
		const springs: Map<number, DragConstraint> = new Map();
		let portal: Portal|null = null;
		let portalOffset: Vector = Vector.create(0, 0);

		const getPositions = (evt: MouseEvent|TouchEvent): DragPoint[] => {
			if (evt instanceof MouseEvent) {
				return [{
					position: Vector.create(evt.pageX, evt.pageY),
					id: 0
				}];
			}

			return Array.from(evt.changedTouches).map(touch => {
				return {
					position: Vector.create(touch.pageX, touch.pageY),
					id: touch.identifier
				};
			});
		};

		const getSprings = (evt: MouseEvent|TouchEvent|number): DragConstraint[] => {
			if (evt instanceof MouseEvent) {
				evt = 0;
			}

			if (typeof evt === 'number') {
				const spr = springs.get(evt);
				return spr ? [spr] : [];
			}

			return Array.from(evt.changedTouches).map(touch => {
				return springs.get(touch.identifier);
			}).filter(spr => spr) as DragConstraint[];
		};

		const setSpring = (spr: DragConstraint) => {
			if (spr.constraint) {
				springs.set(spr.id, spr);
			} else {
				springs.delete(spr.id);
			}
		};

		const downFn = (evt: MouseEvent|TouchEvent) => {
			if (settings?.contains(evt.target as HTMLElement)) {
				return;
			}

			for (const pos of getPositions(evt)) {
				const body = Query.point(world.bodies, pos.position)
					.find(body => body.label === 'cat');

				// if no cat body was found check for a portal
				if (!body) {
					const portalBody = Query.region(world.bodies, Util.pointToBounds(pos.position, 50))
						.find(body => body.label === Portal.LABEL);

					if (Portal.isPortalBody(portalBody)) {
						portal = portalBody.plugin as Portal;
						portalOffset = Vector.sub(portalBody.position, pos.position);
					}
					continue;
				}

				const spr = Constraint.create({
					pointA: pos.position,
					bodyB: body,
					pointB: Vector.sub(pos.position, body.position),
					stiffness: .9,
					damping: 0,
					render: {
						visible: false
					}
				});

				setSpring({
					constraint: spr,
					id: pos.id
				});

				World.add(world, spr);
			}
		};

		const upFn = (evt: MouseEvent|TouchEvent) => {
			for (const spr of getSprings(evt)) {
				setSpring({
					constraint: null,
					id: spr.id
				});

				if (spr.constraint) {
					World.remove(world, spr.constraint);
				}
			}

			if (portal) {
				portal = null;
			}
		};

		const moveFn = (evt: MouseEvent|TouchEvent) => {
			for (const pos of getPositions(evt)) {
				if (portal) {
					portal.setPosition(Vector.add(pos.position, portalOffset));
					continue;
				}

				const spr = getSprings(pos.id)[0];
				if (!spr || !spr.constraint) {
					continue;
				}

				spr.constraint.pointA = pos.position;
			}

			evt.preventDefault();
		};

		const eventOpts: AddEventListenerOptions = {
			passive: false
		};

		window.addEventListener('mousedown', downFn, eventOpts);
		window.addEventListener('touchstart', downFn, eventOpts);
		window.addEventListener('mouseup', upFn, eventOpts);
		window.addEventListener('touchend', upFn, eventOpts);
		window.addEventListener('mousemove', moveFn, eventOpts);
		window.addEventListener('touchmove', moveFn, eventOpts);
	}

	private initEvents() {
		window.addEventListener('resize', evt => {
			this.renderer.canvas.width = window.innerWidth;
			this.renderer.canvas.height = window.innerHeight;
			this.updateBorder();
		});
	}

	// TODO: Fix ...
	private initGyro() {
		const clickFn = (evt: MouseEvent|TouchEvent) => {
			window.removeEventListener('touchstart', clickFn);

			// @ts-ignore
			window.DeviceOrientationEvent?.requestPermission?.();

			window.addEventListener('deviceorientation', event => {
				if (event.gamma === null || event.alpha === null || event.beta === null) {
					return;
				}

				const vector = this.getDownVector(event.gamma, event.alpha);
				this.engine.gravity.x = vector.x;
				this.engine.gravity.y = vector.y;

				console.log(`${event.gamma.toFixed(2)}, ${event.alpha.toFixed(2)}<br>${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}`);
			});
		};

		window.addEventListener('touchstart', clickFn);
	}

	private getDownVector(gamma: number, beta: number) {
		const x = this.engine.gravity.x;
		const y = this.engine.gravity.y;

		// Convert degrees to radians
		const gammaRad = gamma * (Math.PI / 180);
		const betaRad = beta * (Math.PI / 180);

		// Calculate the 2D down vector
		// const downX = Math.sin(gammaRad);
		// const downY = Math.sin(betaRad);

		const cosTheta = Math.cos(betaRad)
		const sinTheta = Math.sin(betaRad)

		const xPrime = x * cosTheta - y * sinTheta;
		const yPrime = x * sinTheta + y * cosTheta;

		return Vector.create(xPrime, yPrime);
	}

	private updateBorder(wallWidth: number = 100) {
		// kill old border
		Composite.remove(this.engine.world, this.border);

		// build new border
		const w = window.innerWidth;
		const h = window.innerHeight;
		const opts: Matter.IChamferableBodyDefinition = {
			isStatic: true,
			label: 'border',
			collisionFilter: {
				group: CatWorld.WALL_LAYER,
				mask: CatWorld.CAT_LAYER | CatWorld.WALL_LAYER
			}
		};

		const bottom = Bodies.rectangle(w / 2, h + wallWidth / 2, w, wallWidth, opts);
		const left = Bodies.rectangle(-wallWidth / 2, h / 2, wallWidth, 99999, opts);
		const right = Bodies.rectangle(w + wallWidth / 2, h / 2, wallWidth, 99999, opts);
		const top = Bodies.rectangle(w / 2, -h, w, wallWidth, opts);

		this.border = [bottom, left, right, top];
		this.maxYPosition = h * 3;

		Composite.add(this.engine.world, this.border);

		// update portals
		for (const portal of this.portals) {
			portal.setPosition();
		}
	}

	private buildCat(data: number|string|Cat, position?: Vector, opts?: ThingData): Body|null {
		const getCat = (): Cat|undefined => {
			if (typeof data === 'string') {
				data = CatWorld.cats.findIndex(c => c.name === data);
			}
			if (typeof data === 'number') {
				return CatWorld.cats[data];
			}
			return data;
		};

		const cat = getCat();
		if (!cat) {
			return null;
		}

		const catData = Util.clone(cat);
		catData.scale = opts?.scale ?? this.catScale;
		catData.bounce = opts?.bounce ?? this.catBounce;

		position = position ?? Vector.create(0, 0);
		return Bodies.fromVertices(position.x, position.y, [
			Vertices.scale(cat.path.map(point => Vector.create(point.x, point.y)), catData.scale, catData.scale, Vector.create(.5, .5))
		], {
			restitution: catData.bounce,
			plugin: catData,
			label: 'cat',
			collisionFilter: {
				group: CatWorld.CAT_LAYER,
				mask: CatWorld.CAT_LAYER | CatWorld.WALL_LAYER
			},
			render: {
				sprite: {
					texture: cat.img,
					xScale: catData.scale,
					yScale: catData.scale
				}
			}
		});
	}

	public addCat(x: number, y: number) {
		const cat = CatWorld.cats[Math.floor(Math.random() * CatWorld.cats.length)];
		const body = this.buildCat(cat, Vector.create(x, y));
		if (!body) {
			return;
		}

		Composite.add(this.engine.world, body);
		this.cats.set(body.id, body);
	}

	public addThing(data: ThingData, portal: string|Portal) {
		if (typeof portal === 'string') {
			const found = this.portals.find(p => p.owner.uuid === portal);
			if (!found) {
				return;
			}

			portal = found;
		}

		if (!portal.body) {
			return;
		}

		const angleDiff = portal.body.angle - data.portalAngle + Portal.FLIP_ANGLE;
		data.velocity = Vector.rotate(data.velocity, angleDiff);

		const position = Util.toGlobalPosition(data.offset, portal.body);
		const cat = this.buildCat(data.name, position, data);
		if (!cat) {
			return;
		}

		// add to tp blacklist
		this.teleportBlacklist.set(cat.id, cat);
		setTimeout(() => {
			this.teleportBlacklist.delete(cat.id);
		}, 200);

		// add to world
		Body.set(cat, data);
		Composite.add(this.engine.world, cat);
		this.cats.set(cat.id, cat);
	}

	public addPortal(portal: Portal): boolean {
		const index = this.portals.indexOf(portal);
		if (index !== -1) {
			return false;
		}

		this.portals.push(portal);
		portal.build(this);
		if (!portal.body) {
			return false;
		}

		Composite.add(this.engine.world, portal.body);
		return true;
	}

	public removePortal(portalOrUser: Portal|Member): boolean {
		const index = this.portals.findIndex(portal => {
			return portalOrUser instanceof Portal ? portal === portal : portal.owner.uuid === portalOrUser.uuid;
		});

		if (index === -1) {
			return false;
		}

		// remove from list
		const removedPortals = this.portals.splice(index, 1);

		// remove body
		for (const portal of removedPortals) {
			if (portal.body) {
				Composite.remove(this.engine.world, portal.body);
			}
			portal.dispose();
		}

		return true;
	}

	public removeCat(body: Body) {
		if (!this.cats.has(body.id)) {
			return;
		}

		Composite.remove(this.engine.world, body);
		this.cats.delete(body.id);
	}
}