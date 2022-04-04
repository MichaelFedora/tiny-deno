import { Server } from 'https://deno.land/std@0.133.0/http/server.ts'

import { text, json, noContent, redirect } from './util.ts';
import Router from './router.ts';

const router = new Router();

router.get('/hello', () => text('world!'));
router.get('/test/:neat', req => json({ params: req.params, query: req.query }));

router.get('/redirect', () => redirect('test/cool'));
router.get('/redirect/2', () => redirect('../test/wowee'));

router.use((req, next) => req.method !== 'GET' ? noContent() : next());

const app = new Server({
  async handler(req) {
    try {
      const res = await router.process(req);
      if(res)
        return res;

      return text('Not Found', { status: 404 });
    } catch(e) {
      console.error(e);
      return text('Error: ' + e, { status: 500 });
    }
  },
  port: 3000
});


console.log('Serving on "http://localhost:3000/"!');
await app.listenAndServe();

Deno.test({ name: 'Run', fn: () => app.listenAndServe() });
