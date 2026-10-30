import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const canvas=require(process.env.CANVAS_MODULE_PATH||'@napi-rs/canvas');
export const {createCanvas}=canvas;
