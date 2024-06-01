import { Engine, Render, Composite, Bodies, Runner, Mouse, MouseConstraint, World, Vector, Common, Vertices, Events, Constraint } from 'matter-js';
// @ts-ignore No types ...
import { decomp } from 'poly-decomp';
import Color from 'color';
import cats from './assets/cats.json';

export interface CatWorldConfig {
	catScale: number;
	catBounce: number;
	catCount: number;
}

export class CatWorld {

	public width: number;
	public height: number;
	private engine!: Engine;
	private renderer!: Render;

	public catScale: number = .5;
	public catBounce: number = 1.4;

	constructor(width: number, height: number, config?: Partial<CatWorldConfig>) {
		this.width = width;
		this.height = height;
		Object.assign(this, config ?? {});
		this.initWorld();
		this.initMouseEvents();
	}

	static init() {
		Common.setDecomp(decomp);
		for (const cat of cats) {
			cat.name = `./src/assets/${cat.name}.png`;
		}
	}

	private initWorld() {
		const engine = Engine.create();
		const runner = Runner.create();
		
		const background = Color({
			r: Math.floor(Math.random() * 255),
			g: Math.floor(Math.random() * 255),
			b: Math.floor(Math.random() * 255)
		});

		const renderer = Render.create({
			element: document.body,
			engine: engine,
			options: {
				width: this.width,
				height: this.height,
				wireframes: false,
				background: `linear-gradient(to bottom, ${background.hex()}, ${background.darken(.7).hex()})`
			},
			textures: cats.map(cat => cat.name)
		});

		const wallWidth = 60;
		const bottom = Bodies.rectangle(this.width / 2, this.height + wallWidth / 2, this.width, wallWidth, { 
			isStatic: true
		});
		const left = Bodies.rectangle(-wallWidth / 2, this.height / 2, wallWidth, 99999, { 
			isStatic: true
		});
		const right = Bodies.rectangle(this.width + wallWidth / 2, this.height / 2, wallWidth, 99999, { 
			isStatic: true
		});

		Composite.add(engine.world, [bottom, left, right]);
		Render.run(renderer);
		Runner.run(runner, engine);

		this.engine = engine;
		this.renderer = renderer;
	}

	private initMouseEvents() {
		const world = this.engine.world;
		const mouse = Mouse.create(this.renderer.canvas);
		const mouseConstraint = MouseConstraint.create(this.engine, {
			mouse: mouse,
			constraint: {
				render: {
					visible: true
				}
			}
		});

		let spring: Constraint|null = null;

		Events.on(mouseConstraint, "mousedown", (event) => {
			const body = mouseConstraint.body;
			if (!body) {
				return;
			}

			spring = Constraint.create({
				pointA: { x: mouse.position.x, y: mouse.position.y },
				bodyB: body,
				pointB: Vector.sub(mouse.position, body.position),
				stiffness: .9,
				damping: 0, 
				render: {
					visible: false
				}
			});

			World.add(world, spring);
		});

		const mouseUpFn = (evt: Event) => {
			if (spring) {
				World.remove(world, spring);
				spring = null;
			}
		};

		window.addEventListener('mouseup', mouseUpFn);
		window.addEventListener('touchend', mouseUpFn);

		Events.on(this.engine, "beforeUpdate", () => {
			if (spring) {
				spring.pointA = { x: mouse.position.x, y: mouse.position.y };
			}
		});

	}

	public add(x: number = this.width / 2, y: number = this.height / 2) {
		const cat = cats[Math.floor(Math.random() * cats.length)];
		const body = Bodies.fromVertices(x, y, [
			Vertices.scale(Vertices.clockwiseSort(cat.path.map(point => Vector.create(point.x, point.y))), this.catScale, this.catScale, Vector.create(.5, .5))
		], {
			restitution: this.catBounce,
			render: {
				sprite: {
					texture: cat.name,
					xScale: this.catScale,
					yScale: this.catScale
				}
			}
		});
		
		Composite.add(this.engine.world, [body]);
	}
}

CatWorld.init();