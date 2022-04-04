import { Router, RouteHandler, noContent, json, redirect } from '../../api/mod.ts';

import { TinyRequest, User } from '../../common/types.ts';
import { handleError } from '../../common/middleware.ts';
import { MalformedError, NotFoundError, NotSupportedError } from '../../common/errors.ts';

import KeyValueStore from '../../common/key-value-store.ts';
import Api from '../../common/api.ts';

import { WebFinger, WebFingerInfo } from './web-finger-types.ts';


/**
 * An Api to handle WebFinger requests
 */
export class WebFingerApi<Req extends TinyRequest> extends Api<Req> {

  readonly symbols = Object.freeze(['.', '~', '-']);

  get separatorRegex(): RegExp {
    const other = this.symbols.filter(s => s !== this.separator).map(s => '\\' + s).join('');
    const regExp = new RegExp(`^([\\w${other}]+)(?:\\${this.separator}([\\w${other}]+))?`);
    return regExp;
  }

  constructor(
    protected readonly kv: KeyValueStore<WebFingerInfo[]>,
    protected readonly getUser: (username: string) => Promise<User | null>,
    protected readonly validateSession: RouteHandler<Req>,
    protected readonly separator = '~') {

    super();

    if(this.symbols.indexOf(separator) < 0)
      throw new NotSupportedError(`Separator must be of a valid type (${this.symbols.map(s => `"${s}"`).join(', ')})!`)
  }

  async storeInfo(context: string, identifier: string, user: string, info: Pick<WebFingerInfo, 'alias' | 'rel' | 'href'>[]) {
    await this.kv.put(user + this.kv.separator + context, info.map(entry => ({
      context,
      identifier,

      user: user,

      alias: Boolean(entry.alias),
      rel: String(entry.rel),
      href: String(entry.href)
    })));
  }

  async getInfo(context: 'secure' | 'root' | 'remote' | string, identifier: string, _domain: string): Promise<WebFinger | 'redirect' | null> {
    if(context === 'remote')
      return 'redirect';

    let user: User | null;
    const info = await this.kv.get(identifier + this.kv.separator + context);

    if(context === 'secure')
      user = null; // await authDb.getUserFromSecureHash(identifier);
    else
      user = await this.getUser(identifier);

    if(!user || (context !== 'root' && !info?.length))
      return null;

    const wfInfo: WebFinger = { };

    if(info) {
      wfInfo.aliases = info.filter(info => info.alias && info.href).map(info => info.href!);
      if(!wfInfo.aliases.length)
        delete wfInfo.aliases;

      wfInfo.links = info.map(i => ({ ...i, alias: undefined }));
    }

    return wfInfo;
  }

  /**
   * Adds the `/.well-known/webfinger` route to the given router, which handles
   * authorized PUT requests for adding info and unauthorized GET requests to get
   * information.
   *
   * @param router The root router
   * @returns The root router
   */
  compile(router = new Router<Req>()): Router<Req> {

    const route = '/.well-known/webfinger';

    router.use(route, handleError('WebFinger'));

    /**
     * Add WebFinger information for the validated session.
     */
    router.put(route, this.validateSession, async req => {
      const body: {
        alias: boolean;
        rel: string;
        href: string;
      }[] = await req.json();

      if(!body || !(body instanceof Array))
        throw new MalformedError('Body must be an array!');

      const context = req.session!.context;
      const identifier = req.session!.identifier;

      await this.storeInfo(context,
        identifier,
        req.user!.id,
        body.filter(o => typeof o === 'object' && Object.hasOwn(o, 'rel'))
          .map(e => ({ alias: e.alias, rel: e.rel, href: e.href })));

      return noContent();
    });

    /**
     * GET the WebFinger information
     */
    router.get(route, async req => {
      let resource = req.query.resource;

      if(!resource)
        throw new MalformedError('Resource query must be given!');

      resource = resource.replace(/^acct:/, '');

      const domain = /@(.*)$/.exec(resource)?.[1];

      if(!domain)
        throw new MalformedError('Domain could not be parsed!');

      try {
        const domainUrl = new URL('https://' + domain);

        if(domainUrl.host !== domain)
          throw null;

      } catch {
        throw new MalformedError('Domain is not a valid URL!');
      }

      const url = new URL(req.url);

      let identifier: string, context: string;

      if(domain === url.host) {
        [ identifier, context ] = this.separatorRegex.exec(resource)?.slice(1) || [ ];

        if(identifier && !context)
          context = 'root';

      } else {
        identifier = /^([\w\.\-\~]+)/.exec(resource)?.[1] || '';
        context = 'remote';
      }

      if(!identifier || !context)
        throw new MalformedError('Could not parse!');

      const sewn = (context === 'remote' || context === 'root' ? identifier : `${identifier}${this.separator}${context}`) + '@' + domain;

      if(resource !== sewn)
        throw new MalformedError(`Re-sewn resource identifier "${sewn}" is not equal to that which was given "${resource}" (bad parse)!`);

      const info = await this.getInfo(context, identifier, domain);

      if(!info)
        throw new NotFoundError();

      if(info === 'redirect')
        return redirect(`https://${domain}/.well-known/webfinger?resource=acct:${resource}${req.query.rel ? `&rel=${req.query.rel}` : ''}`);

      if(info.links?.length && req.query.rel)
        info.links = /* req.query.rel instanceof Array ? info.links.filter(l => req.query.rel.includes(l)) : */ info.links.filter(l => l.rel === req.query.rel);


      // if context is not `root`, should we insert root as an alias?


      return json({ ...info, subject: `acct:${resource}` }, { headers: { 'Content-Type': 'application/jrd+json' }});
    });

    return router;
  }
}

export default WebFingerApi;
