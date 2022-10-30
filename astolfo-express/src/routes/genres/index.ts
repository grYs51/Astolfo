import { Router } from 'express';
import { getDetail, getList, post } from './handlers';

export default (router: Router) => {
  // router //
  //   .route('/v1/genres')
  //   .get(checkJwt, getList)
  //   .post(checkJwt, post);

  router //
    .route('/v1/genres/:id')
    .get(getDetail);
};
