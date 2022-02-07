import { Evt } from '../../deps/evt.ts';

import { DynTableStore, ColumnType } from '../../common/dyn-table-store.ts';

import AuthDb from '../auth-db.ts';

import { AuthUser, AuthSession, Handshake, MasterKey } from '../auth-types.ts';


export class HelpfulAuthDb extends AuthDb {

  constructor(protected readonly dynTableStore: DynTableStore,
    config: { sessionExpTime?: number; handshakeExpTime?: number } = { }) {

    const _onUserDelete = new Evt<AuthUser>();

    super(config, Evt.asNonPostable(_onUserDelete));
  }

  async init(): Promise<void> {
    await this.dynTableStore.init();

    await this.dynTableStore.redefine<AuthSession>('sessions', {
      columns: {
        id: { type: ColumnType.ID, nullable: false, meta: 'ID!' },
        user: { type: ColumnType.ID, nullable: false, meta: 'User!' },
        scopes: { type: ColumnType.JSON, nullable: false, meta: 'JSON' },
        created: { type: ColumnType.Date, nullable: false, meta: 'Date' }
      },
      indexes: [{ fields: ['user'] }, { fields: ['created'] }]
    });

    await this.dynTableStore.redefine<AuthUser>('users', {
      columns: {
        id: { type: ColumnType.ID, nullable: false, meta: 'ID!' },
        username: { type: ColumnType.Date, nullable: false, meta: 'String' },
        pass: { type: ColumnType.String, nullable: false, meta: 'NO' },
        salt: { type: ColumnType.String, nullable: false, meta: 'NO' },
        created: { type: ColumnType.Date, nullable: false, meta: 'Date' },
      },
      indexes: [{ fields: ['username'], unique: true }]
    });

    await this.dynTableStore.redefine<Handshake>('handshakes', {
      columns: {
        id: { type: ColumnType.ID, nullable: false, meta: 'ID!' },
        code: { type: ColumnType.String, nullable: true, meta: 'String' },
        user: { type: ColumnType.ID, nullable: true, meta: 'User' },
        app: { type: ColumnType.String, nullable: true, meta: 'String' },
        redirect: { type: ColumnType.String, nullable: false, meta: 'String' },
        scopes: { type: ColumnType.JSON, nullable: false, meta: 'JSON' },
        created: { type: ColumnType.Date, nullable: false, meta: 'Date' },
      },
      indexes: [{ fields: ['user'] }, { fields: ['created'] }]
    });

    await this.dynTableStore.redefine<MasterKey>('masterKeys', {
      columns: {
        id: { type: ColumnType.ID, nullable: false, meta: 'ID!' },
        user: { type: ColumnType.ID, nullable: false, meta: 'User!' },
        name: { type: ColumnType.String, nullable: true, meta: 'String' },
        created: { type: ColumnType.Date, nullable: false, meta: 'Date' },
      },
      indexes: [{ fields: ['user'] }]
    });
  }

  protected get sessions() { return this.dynTableStore.table<AuthSession>('sessions'); }
  protected get users() { return this.dynTableStore.table<AuthUser>('users'); }
  protected get handshakes() { return this.dynTableStore.table<Handshake>('handshakes'); }
  protected get masterKeys() { return this.dynTableStore.table<MasterKey>('masterKeys'); }

  async addSession(user: string, scopes?: readonly string[]): Promise<string> {
    const sess = await this.sessions.add({ user, scopes, created: Date.now() });
    return sess.id!;
  }

  async getSession(session: string): Promise<AuthSession | null> {
    return await this.sessions.one(session);
  }

  async delSession(session: string): Promise<void> {
    return await this.sessions.del(session);
  }

  async delManySessions(sessions: readonly string[]): Promise<void> {
    return await this.sessions.delMany(sessions);
  }

  /** Delete all expired sessions */
  async cleanSessions(): Promise<void> {
    const sessions = await this.sessions.search({ query: { created: { $lt: Date.now() - this.sessionExpTime } }, projection: ['id'] });
    await this.delManySessions(sessions.map(s => s.id!));
  }

  async getSessionIdsForUser(user: string): Promise<string[]> {
    return await this.sessions.search({ query: { user }, projection: ['id'] }).then(res => res.map(s => s.id!));
  }

  async getSessionsForUser(user: string): Promise<AuthSession[]> {
    return await this.sessions.all({ user });
  }

  // users

  async addUser(user: AuthUser): Promise<string> {
    return await this.users.add(user).then(res => res.id!);
  }

  async putUser(id: string, user: AuthUser): Promise<void> {
    await this.users.put(id, user);
  }

  async getUser(id: string): Promise<AuthUser | null> {
    return await this.users.one(id);
  }

  async delUser(id: string): Promise<void> {
    const user = await this.users.one(id);
    if(!user)
      return;

    await this.users.del(id);
    Evt.asPostable(this.onUserDelete).post(user);
  }

  async getUserFromUsername(username: string): Promise<AuthUser | null> {
    const users = await this.users.search({ query: { username }, limit: 2 });
    if(users.length > 1)
      throw new Error('More than one user for this username exists!');

    return users[0];
  }

  // handshakes

  async addHandshake(hs: Handshake): Promise<string> {
    return await this.handshakes.add(hs).then(res => res.id!);
  }

  async putHandshake(id: string, hs: Handshake): Promise<void> {
    await this.handshakes.put(id, hs);
  }

  async getHandshake(id: string): Promise<Handshake | null> {
    return await this.handshakes.one(id);
  }

  async delHandshake(id: string): Promise<void> {
    await this.handshakes.del(id);
  }

  async getHandshakeFromCode(code: string): Promise<Handshake | null> {
    const handshakes = await this.handshakes.search({ query: { code }, limit: 2 });
    if(handshakes.length > 1)
      throw new Error(`More than one handshake with this code ("${code}") exists!`);

    return handshakes[0];
  }

  /** Delete all expires handshakes */
  async cleanHandshakes(): Promise<void> {
    const handshakes = await this.handshakes.search({ query: { created: { $lt: Date.now() - this.handshakeExpTime } }, projection: ['id'] });
    await this.handshakes.delMany(handshakes.map(hs => hs.id!));
  }

  // master keys

  async addMasterKey(key: MasterKey): Promise<string> {
    return await this.masterKeys.add(key).then(res => res.id!);
  }

  async putMasterKey(id: string, key: MasterKey): Promise<void> {
    await this.masterKeys.put(id, key);
  }

  async getMasterKey(id: string): Promise<MasterKey | null> {
    return await this.masterKeys.one(id);
  }

  async delMasterKey(id: string): Promise<void> {
    await this.masterKeys.del(id);
  }

  async getMasterKeysForUser(user: string): Promise<MasterKey[]> {
    return await this.masterKeys.all({ user });
  }
}

export default HelpfulAuthDb;
