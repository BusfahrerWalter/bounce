import Color from "color";
import { Body, Bounds, Vector } from "matter-js";

export class Util {
	/**
	 * Returns a random integer number between `min` and `max`
	 * @param min Min number (inclusive)
	 * @param max Max number (inclusive)
	 * @returns Random number
	 */
	static random(min: number, max: number): number {
		return Math.floor(Math.random() * (max + 1 - min)) + min;
	}

	static randomString(len: number): string {
		return 'x'.repeat(len).replace(/x/g, () => {
			return String.fromCharCode(Util.random(65, 90));
		});
	}

	static clone<T = any>(obj: T): T {
		return JSON.parse(JSON.stringify(obj));
	}

	static clamp(val: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, val));
	}

	static clampVector(vec: Vector, bounds: Bounds): Vector {
		return Vector.create(
			Util.clamp(vec.x, bounds.min.x, bounds.max.x),
			Util.clamp(vec.y, bounds.min.y, bounds.max.y)
		);
	}

	static closestPoint(point: Vector, rect: Bounds, padding: number = 0): { point: Vector, ref: Vector } {
		point = Util.clampVector(point, rect);
		const xdMin = Math.abs(point.x - rect.min.x);
		const xdMax = Math.abs(point.x - rect.max.x);
		const ydMin = Math.abs(point.y - rect.min.y);
		const ydMax = Math.abs(point.y - rect.max.y);
		const min = Math.min(xdMin, xdMax, ydMin, ydMax);
		const center = Vector.create(rect.min.x + (rect.max.x - rect.min.x) / 2, rect.min.y + (rect.max.y - rect.min.y) / 2);

		if (min === xdMin) {
			point.y = Util.clamp(point.y, rect.min.y + padding, rect.max.y - padding);
			return {
				point: Vector.create(rect.min.x, point.y),
				ref: Vector.create(center.x, point.y)
			};
		}
		if (min === xdMax) {
			point.y = Util.clamp(point.y, rect.min.y + padding, rect.max.y - padding);
			return {
				point: Vector.create(rect.max.x, point.y),
				ref: Vector.create(center.x, point.y)
			};
		}
		if (min === ydMin) {
			point.x = Util.clamp(point.x, rect.min.x + padding, rect.max.x - padding);
			return {
				point: Vector.create(point.x, rect.min.y),
				ref: Vector.create(point.x, center.y)
			};
		}
		if (min === ydMax) {
			point.x = Util.clamp(point.x, rect.min.x + padding, rect.max.x - padding);
			return {
				point: Vector.create(point.x, rect.max.y),
				ref: Vector.create(point.x, center.y)
			};
		}

		throw new Error('Upsi ...');
	}

	static toLocalPosition(pos: Vector, body: Body): Vector {
		const relativePos = Vector.sub(pos, body.position);
		return Vector.rotate(relativePos, -body.angle);
	}

	static toGlobalPosition(pos: Vector, body: Body): Vector {
		const rotatedPos = Vector.rotate(pos, body.angle);
		return Vector.add(rotatedPos, body.position);
	}

	static pointToBounds(point: Vector, size: number): Bounds {
		return {
			min: Vector.create(point.x - size, point.y - size),
			max: Vector.create(point.x + size, point.y + size)
		};
	}

	static setStyle(el: HTMLElement, style: {[key: string]: any}) {
		for (const key in style) {
			el.style.setProperty(key, style[key]);
		}
	}

	static contrastRatio(lum1: number, lum2: number): number {
		const bright = Math.max(lum1, lum2);
		const dark = Math.min(lum1, lum2);
		return (bright + .05) / (dark + .05);
	}
}