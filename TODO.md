# TODO

- public (read) db scope
  - so we can use a straight db instead of json files
  - easier to keep up-to-date as well
- shared permissions (!)
- pull frontend from `tiny-node-vue` vs home's `tiny-home-vue`

- change-pass should refresh the token automatically I think

- add contexts: `context: 'root' | {app}, identifier: 'user'`
- add "secure" context, which is defined as a `context: 'secure', identifier: 'scope/hash'` and would require
a third party to verify, e.g. the blockchain. Should be implemented in the auth module
  - this should also provide a secure/private appdata folder which cannot be accessed by any other app (instead of generic folders)
