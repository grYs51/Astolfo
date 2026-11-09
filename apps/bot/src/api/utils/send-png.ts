import { Response } from 'express';
import { renderPng } from '../../cards/render';

/**
 * A card as a PNG download; private, because what it shows depends on the viewer.
 * Renders before setting any header, so a failed render reaches the error handler as plain JSON.
 */
export const sendPng = async (res: Response, svg: string, filename: string) => {
  const png = await renderPng(svg);
  // attachment: the dashboard is on another origin, where <a download> is ignored
  res.type('png').attachment(filename).set('Cache-Control', 'private, max-age=300').send(png);
};
