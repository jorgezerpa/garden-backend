import EventEmitter from "events";

const eventHub = new EventEmitter();

eventHub.setMaxListeners(0)

export { eventHub }