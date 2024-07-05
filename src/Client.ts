import { Vector } from "matter-js";
import { Util } from "./util/Util";
import { CatWorld } from "./CatWorld";
import { Portal } from "./Portal";

enum MessageType {
	SELF = 'SELF',
	MEMBERS = 'MEMBERS',
	JOINED = 'JOINED',
	LEFT = 'LEFT',
	MESSAGE = 'MESSAGE'
}

export interface Member {
	name: string;
	uuid: string;
}

export interface ThingData {
	name: string;
	velocity: Vector;
	angularVelocity: number;
	angle: number;
	offset: Vector;
	scale: number;
	bounce: number;
	portalAngle: number;
}

interface MessageData {
	origin: string;
	thing: string; // will be a base64 encoded ThingData
}

interface MessageMessage {
	type: MessageType.MESSAGE;
	message: MessageData;
}

interface MembersMessage {
	type: MessageType.MEMBERS;
	members: Member[];
}

interface SelfMessage {
	type: MessageType.SELF;
	name: string;
	uuid: string;
}

interface JoinOrLeaveMessage {
	type: MessageType.JOINED | MessageType.LEFT;
	user: Member;
}

type Message<T extends MessageType = any> =
	T extends MessageType.SELF ? SelfMessage :
	T extends MessageType.MEMBERS ? MembersMessage :
	T extends MessageType.JOINED | MessageType.LEFT ? JoinOrLeaveMessage :
	T extends MessageType.MESSAGE ? MessageMessage : never;

export class Client {

	private static readonly WEBSOCKET_BASE_URL = 'wss://adam-sandler.de/portal';

	private socket: WebSocket;
	private world: CatWorld;

	public name: string;
	public members: Member[] = [];
	public uuid?: string;

	constructor(world: CatWorld, name?: string) {
		this.world = world;
		this.name = name ?? Client.requestName();
		this.socket = new WebSocket(`${Client.WEBSOCKET_BASE_URL}/${this.name}`);
		this.init();
	}

	private static requestName(): string {
		const url = new URL(window.location.href);
		const urlName = url.searchParams.get('name');
		if (urlName) {
			return urlName;
		}

		const name = localStorage.getItem('my-name');
		if (name) {
			return name;
		}

		const newName = prompt('Enter your name', 'egon34');
		if (newName) {
			localStorage.setItem('my-name', newName);
			return newName;
		}

		return Util.randomString(22);
	}

	private static isMessage(obj: any): obj is Message {
		return typeof obj !== 'undefined' && typeof obj.type === 'string';
	}

	private static isThingData(obj: any): obj is ThingData {
		return typeof obj !== 'undefined' && typeof obj.name === 'string' && typeof obj.velocity === 'object';
	}

	private init() {
		this.socket.addEventListener('open', this.onSocketOpen.bind(this));
		this.socket.addEventListener('close', this.onSocketClose.bind(this));
		this.socket.addEventListener('error', this.onSocketError.bind(this));
		this.socket.addEventListener('message', this.onSocketMessage.bind(this));
	}

	private onSocketOpen(evt: Event) {

	}

	private onSocketClose(evt: Event) {

	}

	private onSocketError(evt: Event) {

	}

	private onSocketMessage(evt: MessageEvent) {
		if (!evt.data) {
			return;
		}

		const msg = JSON.parse(evt.data);
		if (!Client.isMessage(msg)) {
			return;
		}

		switch (msg.type) {
			case MessageType.SELF: this.handleSelf(msg); break;
			case MessageType.MESSAGE: this.handleMessage(msg); break;
			case MessageType.MEMBERS: this.handleMembers(msg); break;
			case MessageType.JOINED:
			case MessageType.LEFT: this.handleJoinOrLeave(msg); break;
		}
	}

	private handleMessage(msg: MessageMessage) {
		const thingData = JSON.parse(atob(msg.message.thing));
		if (!Client.isThingData(thingData)) {
			return;
		}

		this.world.addThing(thingData, msg.message.origin);
	}

	private handleSelf(msg: SelfMessage) {
		this.name = msg.name;
		this.uuid = msg.uuid;
	}

	private handleMembers(msg: MembersMessage) {
		this.members = msg.members;
		for (const member of this.members) {
			this.world.addPortal(new Portal(this, member));
		}
	}

	private handleJoinOrLeave(msg: JoinOrLeaveMessage) {
		// handle join
		if (msg.type === MessageType.JOINED) {
			this.members.push(msg.user);
			this.world.addPortal(new Portal(this, msg.user));
			return;
		}

		// handle leave
		const index = this.members.findIndex(member => {
			return member.uuid === msg.user.uuid;
		});

		if (index === -1) {
			return
		}

		const removed = this.members.splice(index, 1);
		this.world.removePortal(removed[0]);
	}

	public sendMessage(destination: string, thing: ThingData) {
		if (!this.uuid || this.socket.readyState !== WebSocket.OPEN) {
			return;
		}

		const data = {
			origin: this.uuid,
			destination: destination,
			thing: btoa(JSON.stringify(thing))
		};

		this.socket.send(JSON.stringify(data));
	}
}