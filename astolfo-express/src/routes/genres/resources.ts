export interface GenrePayload {
  slug: string;
  name: string;
}

export interface GenreReply extends GenrePayload {
  id: string;
}
