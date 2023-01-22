# TODO

- public (read) db scope
  - so we can use a straight db instead of json files
  - easier to keep up-to-date as well
- multiplayer storage / shared permissions (!)
  - will be required for production apps or those that wish to monetize in some way
- pull frontend from `tiny-node-vue` vs home's `tiny-home-vue`

- change-pass should refresh the token automatically I think

- add contexts: `context: 'root' | {app}, identifier: 'user'`
- add "secure" context, which is defined as a `context: 'secure', identifier: 'scope/hash'` and would require
a third party to verify, e.g. the blockchain. Should be implemented in the auth module
  - this should also provide a secure/private appdata folder which cannot be accessed by any other app (instead of generic folders)
- make file api have locks and etag/version checks for race conditions (similar to gaia)

- migrate REST api to [graphql->SOFA](https://www.sofa-api.com/)[^1] like implementation
  - Sofa has quite a few issues that make it impossible to use, such as sending objects that are too big
  and not liking object parameters (since it requires them to be serializable for URL search params)

[^1]: https://github.com/Urigo/SOFA
