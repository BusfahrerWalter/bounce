import { Bodies, Body, Composite, Vector } from "matter-js";
import { Client, Member } from "./Client";
import { Cat, CatWorld } from "./CatWorld";
import { Util } from "./util/Util";
import Color from "color";

export class Portal {

	public static readonly LABEL = 'portal';
	public static readonly SIZE = 500;
	public static readonly BASE_ANGLE: number = 1.570796326794896; // 90deg in radiants
	public static readonly FLIP_ANGLE: number = 3.141592653589793; // 180deg in radiants
	public static readonly COLORS: Color[] = [Color('#0000ff'), Color('#ff0000')];

	public owner: Member;
	public body?: Body;
	private world?: CatWorld;
	private client: Client;
	private position?: Vector;
	private text?: HTMLElement;

	constructor(client: Client, owner: Member) {
		this.client = client;
		this.owner = owner;
	}

	public static isPortalBody(body: any): body is Body & { label: 'portal', plugin: Portal } {
		return typeof body === 'object' && body.label === Portal.LABEL && body.plugin instanceof Portal;
	}

	public build(world: CatWorld) {
		let index = 0;
		let maxContrast = 0;

		for (let i = 0; i < Portal.COLORS.length; i++) {
			const contrast = world.background.contrast(Portal.COLORS[i]);
			if (contrast > maxContrast) {
				maxContrast = contrast;
				index = i;
			}
		}

		this.body = Bodies.rectangle(0, 300, 500, 50, {
			isStatic: true,
			isSensor: true,
			angle: Portal.BASE_ANGLE,
			label: Portal.LABEL,
			plugin: this,
			render: {
				sprite: {
					xScale: .2,
					yScale: .2,
					texture: `./assets/portal${index + 1}.png`
				}
			}
		});

		this.world = world;
		this.setPosition(this.body.position);
	}

	public dispose() {
		if (this.text) {
			this.text.remove();
		}
	}

	public teleport(catBody: Body) {
		if (!this.body) {
			return;
		}

		const cat = catBody.plugin as Cat;
		this.client.sendMessage(this.owner.uuid, {
			name: cat.name,
			scale: cat.scale,
			bounce: cat.bounce,
			velocity: catBody.velocity,
			angularVelocity: catBody.angularVelocity,
			angle: catBody.angle,
			offset: Util.toLocalPosition(catBody.position, this.body),
			portalAngle: this.body.angle
		});
	}

	public setPosition(pos?: Vector) {
		pos = pos ?? this.position;
		if (!pos || !this.body || !this.world) {
			return;
		}

		const pointData = Util.closestPoint(pos, this.world.bounds, Portal.SIZE / 2);
		const angle = Vector.angle(pointData.point, pointData.ref) + Portal.BASE_ANGLE;

		Body.setPosition(this.body, pointData.point);
		Body.setAngle(this.body, angle);

		this.updateTextPosition();
		this.position = pointData.point;
	}

	private updateTextPosition() {
		if (!this.body || !this.world) {
			return;
		}

		const el = this.text ?? document.createElement('div');
		el.textContent = this.owner.name;

		if (!this.text) {
			document.body.append(el);
			el.classList.add('user-name-tag');
			this.text = el;
		}

		const bounds = this.body.bounds;
		const width = bounds.max.x - bounds.min.x;
		const pos = Vector.create(bounds.min.x, bounds.min.y);

		Util.setStyle(el, {
			'top': `${pos.y}px`,
			'left': `${pos.x}px`,
			'min-width': `${width}px`
		});

		const rect = el.getBoundingClientRect();
		const clampedPos = Vector.create(
			Util.clamp(rect.x, 0, window.innerWidth - rect.width),
			Util.clamp(rect.y, 0, window.innerHeight - rect.height - 5)
		);

		Util.setStyle(el, {
			'top': `${clampedPos.y}px`,
			'left': `${clampedPos.x}px`
		});
	}
}