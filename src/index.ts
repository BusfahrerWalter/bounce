import { CatWorld, CatWorldConfig } from "./CatWorld";
import { Client } from "./Client";
import { Util } from "./util/Util";

type StringIndexable = {
	[key: string]: any;
};

window.addEventListener('DOMContentLoaded', async () => {
	await CatWorld.init();

	const config = (JSON.parse(localStorage.getItem('cat-data') ?? '{}')) as Partial<CatWorldConfig>;
	const world = new CatWorld(config);

	// @ts-ignore
	window.world = world;

	// @ts-ignore
	window.Util = Util;

	const url = new URL(window.location.href);
	if (url.searchParams.get('multiplayer') === 'yes') {
		// @ts-ignore
		window.client = new Client(world);
	}

	window.addEventListener('mousedown', evt => {
		if (evt.button === 2) {
			world.addCat(evt.pageX, evt.pageY);
		}
	});

	for (let i = 0; i < (config.catCount ?? 5); i++) {
		const x = 100 + Math.floor(Math.random() * window.innerWidth - 200);
		const y = 100 + Math.floor(Math.random() * window.innerHeight - 200);
		world.addCat(x, y);
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

// const logFn = console.log;
// console.log = function(...data: any[]) {
// 	let logContainer = document.getElementById('log-container');
// 	if (!logContainer) {
// 		logContainer = document.createElement('div');
// 		logContainer.id = 'log-container';
// 		document.body.append(logContainer);
// 	}

// 	for (const item of data) {
// 		logContainer.innerHTML = `<br>${item}`;
// 	}

// 	return logFn(...data);
// }