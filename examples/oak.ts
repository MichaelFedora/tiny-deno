import { Application, Router as OakRouter, send } from '../deps-testing/oak.ts';

import { appendRouterToOak } from '../api/helpers/oak.ts';
import { MalformedError } from '../common/errors.ts';

import { pagePath, realBasePath, router } from './common.ts';

const app = new Application();

// oak error listener
app.addEventListener('error', evt => {
  console.error('Oak Error:', evt.error);
});

// oak error catcher middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch(e) {
    ctx.response.status = 500;
    ctx.response.body = 'Internal Error';
    console.error('Oak Internal Error Caught:', e);
  }
});

// cors
app.use((ctx, next) => {
  if(Deno.args.includes('--cors'))
    ctx.response.headers.append('access-control-allow-origin', '*');

  if(ctx.request.method !== 'OPTIONS')
    return next();

  ctx.response.status = 204;
  ctx.response.headers.append('allow', '*');
});

// handle the tiny router; backup in case the append doesn't work
/*
app.use(async (ctx, next) => {
  const req = Object.assign(ctx.request.originalRequest.request, { stream: ctx.request.body({ type: 'stream' })?.value });

  const res = await router.process(req);
  if(!res)
    return next();

  for(const [k, v] of res.headers.entries())
    ctx.response.headers.append(k, v)

  ctx.response.status = res.status
  ctx.response.body = res.body
});
*/

const oakRouter = new OakRouter();

// append the tiny router to oak (doesn't work)
appendRouterToOak(router, oakRouter);

oakRouter.get('/:path(.*)', async (ctx, next) => {
  if(ctx.request.method !== 'GET' || !ctx.params.path)
    return next();

  try {

    let path: string = realBasePath + '/' + ctx.params.path;
    path = await Deno.realPath(path);

    if(!path.includes(realBasePath))
      return next();

    return await send(ctx, path, { root: '/' });

  } catch(e) {

    if(e instanceof URIError)
      throw new MalformedError('Bad URI');
    if(e instanceof Deno.errors.NotFound)
      return next();

    throw e;
  }
});

oakRouter.use((ctx, next) => ctx.request.method !== 'GET' ? next() : send(ctx, pagePath));

app.use(oakRouter.allowedMethods(), oakRouter.routes());

// listen console log
app.addEventListener('listen', ({ hostname, port, secure }) => {
  if(hostname === '0.0.0.0')
    hostname = 'localhost';

  const protocol = secure ? 'https' : 'http';

  console.log(`Serving Tiny-STD on ${protocol}://${hostname ?? 'localhost'}:${port} !`);
});

app.listen({ port: 3000 });
