import { CatWorld, CatWorldConfig } from "./CatWorld";

type StringIndexable = {
	[key: string]: any;
};

window.addEventListener('DOMContentLoaded', () => {
	const config = (JSON.parse(localStorage.getItem('cat-data') ?? '{}')) as Partial<CatWorldConfig>;
	const world = new CatWorld(window.innerWidth, window.innerHeight, config);

	window.addEventListener('mousedown', evt => {
		if (evt.button === 2) {
			world.add(evt.pageX, evt.pageY);
		}
	});

	for (let i = 0; i < (config.catCount ?? 5); i++) {
		const x = 100 + Math.floor(Math.random() * world.width - 200);
		const y = 100 + Math.floor(Math.random() * world.height - 200);
		world.add(x, y);
	}

	const catCountInput = document.getElementById('cat-count') as HTMLInputElement;
	const catBounceInput = document.getElementById('cat-bounce') as HTMLInputElement;
	const catScaleInput = document.getElementById('cat-scale') as HTMLInputElement;
	const inputs = document.querySelectorAll('#settings input') as NodeListOf<HTMLInputElement>;

	catCountInput.value = (config.catCount ?? 5).toString();
	catBounceInput.value = (config.catBounce ?? world.catBounce).toString();
	catScaleInput.value = (config.catScale ?? world.catScale).toString();

	for (const input of inputs) {
		input.addEventListener('input', evt => {
			const key = input.getAttribute('config');
			if (!key) {
				return;
			}

			const value = parseFloat(input.value);
			(config as StringIndexable)[key] = value;
			(world as StringIndexable)[key] = value;
			localStorage.setItem('cat-data', JSON.stringify(config));
		});
	}
}); 