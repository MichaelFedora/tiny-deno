# Tiny Level Host

## Still in progress

A tiny software to host a multi-user leveldb database unit.

**Warning**: There is no encryption here, and therefore no privacy
from the host. Applications must encrypt the db entries if they so desire.
In addition, there is no limit to the amount of keys stored, so beware
of users loading junk data.

### Config

in `config.json`, with the following (annotated) schema:

```typescript
interface Config {
  ip: string; // api ip
  port: number; // api port

  sessionExpTime: number; // how much time (in ms) for the sessions to expire
  whitelist?: string[]; // a white list of usernames to allow

  dbName: string; // level db folder name
}
```

### API

todo

### todo

- public (read) db scope
  - so we can use a straight db instead of json files
  - easier to keep up-to-date as well
- shared permissions (!)
- pull frontend from `tiny-node-vue` vs home's `tiny-home-vue`

- change-pass should refresh the token automatically I think

### License

MIT
