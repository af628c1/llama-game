// Naming for interior data. Each interior (see INTERIORS in config.js) is described by a
// JSON spec from the art pack; its room and object textures are keyed under its id so
// that two interiors can both have, say, a 'bed'.

export const interiorKey = (id) => `interior:${id}`; // the spec, in the JSON cache
export const interiorTex = (id, part) => `interior:${id}:${part}`; // 'room' or an object id

// An object that looks different by state (a trough that is empty or full) has one image
// per state.
export const interiorStateTex = (id, objectId, state) => interiorTex(id, `${objectId}:${state}`);
