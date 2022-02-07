import { assertEquals } from '../../deps/std.ts';

import { DB } from 'https://deno.land/x/sqlite/mod.ts';

import { User } from '../../common/types.ts';
import HelpfulTinyDb from '../../db/helpers/helpful-tiny-db.ts';

import SQLiteDynTableStore from './sqlite-dyn-table-store.ts';
import SQLiteKeyValueStore from './sqlite-key-value-store.ts';

export class SQLiteHelpfulTinyDb extends HelpfulTinyDb {
  constructor(db: DB, getUser: (id: string) => Promise<User | null>, sqlitePrefix = '', tinyPrefix = '') {
    super(new SQLiteKeyValueStore(db, `${sqlitePrefix ? sqlitePrefix + '_' : ''}KeyValue`),
      new SQLiteDynTableStore(db, sqlitePrefix),
      getUser,
      tinyPrefix);
  }

  async init(): Promise<void> {
    await super.init();
  }
}

Deno.test({
  name: 'SQLiteHelpfulTinyDb Test',
  async fn(): Promise<void> {
    console.log('Initializing...');
    const db = new SQLiteHelpfulTinyDb(new DB(':memory:'), () => Promise.resolve(null), 'quite', 'tiny');
    await db.init();

    console.log('Testing KeyValue store...');

    const key = await db.add('user', 'scope', { my: 'value' });
    assertEquals(await db.get('user', 'scope', key), { key, my: 'value' });
    await db.put('user', 'scope', 'key', 'value');
    assertEquals(await db.get('user', 'scope', 'key'), 'value');
    await db.del('user', 'scope', key);
    assertEquals(await db.get('user', 'scope', key), null);
    await db.delAllUserData('user');
    assertEquals(await db.get('user', 'scope', 'key'), null);

    console.log('Testing GraphQL store...');

    const userSchema = 'type User { id: ID!, name: String, prefs: JSON, wow: Wow }';
    const schemas = await db.registerSchemas('user', 'scope', userSchema, 'type Wow');
    console.log('Created User Schema:', userSchema);

    assertEquals(schemas, [ {
      id: undefined,
      user: 'user',
      scope: 'scope',
      name: 'User',
      fields: [
        { key: 'id', type: 'ID!' },
        { key: 'name', type: 'String' },
        { key: 'prefs', type: 'JSON' },
        { key: 'wow', type: 'Wow' }
      ]
    } ]);
    assertEquals(await db.getSchemas('user', 'scope'), schemas);

    await db.registerSchemas('user', 'scope', 'type Wow { date: Date }');
    console.log('Initialized Wow Schema:', 'type Wow { date: Date }');

    const wowResult = await db.query<{
      addWow: { id: string; date: string }
    }>('user', 'scope', /* GraphQL */ `mutation { addWow(input: { date:"${new Date()}" }) { id, date } }`);
    console.log('Added Wow', wowResult);

    const res = await db.query<{
      addUser: {
        id: string;
        name: string;
        prefs: unknown;
        wow: { id: string; date: string };
      }
    }>('user', 'scope', /* GraphQL */ `mutation {
      addUser(input: { name:"Bob", prefs: { cool: true }, wow:"${wowResult.data!.addWow!.id}" }) { id, name, prefs, wow { id, date } }
    }`);
    console.log('Added User', res);
  }
});
