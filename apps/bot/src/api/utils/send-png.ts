import { Response } from 'express';
import { renderPng } from '../../cards/render';

/** A card as a PNG response; private, because what it shows depends on the viewer */
export const sendPng = async (res: Response, svg: string) => {
  res
    .type('png')
    .set('Cache-Control', 'private, max-age=300')
    .send(await renderPng(svg));
};
