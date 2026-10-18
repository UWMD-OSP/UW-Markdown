// Observation only; never imported by production without the isolated loader.
export const phases=[];
export function phase(value){phases.push(value);}
export function clear(){phases.length=0;}
