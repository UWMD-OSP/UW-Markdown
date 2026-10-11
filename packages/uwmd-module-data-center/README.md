# @uwmd/module-data-center

Compatibility shell for existing installations. Official `data_center` content is now builtin in `@uwmd/core` (RFC 0080). This manifest declares no classes, sections, calculations, rules or views. Existing module-list dependencies are satisfied by core with CLS-02.

Version `0.2.0` pins `@uwmd/core` 3.0.0 exactly and is the final version of this package: the 3.0.0 transition release carries it, and the package name is then deprecated on npm. New code needs no module: depend on `@uwmd/core` 3.0.0 or later and use the builtin `data_center` class.

```
npm install --save-exact @uwmd/core@3.0.0
```

Existing installs that pin this package keep resolving. Package `0.2.0`, manifest contract `0.2.0` and manifest schema `1` version independently.
