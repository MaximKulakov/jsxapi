# JSXAPI

[![Build Status](https://travis-ci.org/cisco-ce/jsxapi.svg?branch=master)](https://travis-ci.org/cisco-ce/jsxapi)

[API Documentation](https://cisco-ce.github.io/jsxapi/)

A set of tools to integrate with the Cisco Telepresence Endpoint APIs in
JavaScript.

## Quick start examples

### Connecting using WebSockets

``` javascript
const jsxapi = require('jsxapi');

jsxapi
  .connect('wss://host.example.com', {
    username: 'admin',
    password: 'password',
  })
  .on('error', console.error)
  .on('ready', async (xapi) => {
    const volume = await xapi.status.get('Audio Volume');
    console.log(`volume is: ${volume}`);
    xapi.close();
  });
```

### Connecting using SSH

``` javascript
const jsxapi = require('jsxapi');

jsxapi
  .connect('ssh://host.example.com', {
    username: 'admin',
    password: 'password',
  })
  .on('error', console.error)
  .on('ready', async (xapi) => {
    const volume = await xapi.status.get('Audio Volume');
    console.log(`volume is: ${volume}`);
    xapi.close();
  });
```

### New style API

The aim of the new style API is to improve readability, while also being more
suited towards automatic type generation and auto-completion.

```javascript
// Set up a call
xapi.Command.Dial({ Number: 'user@example.com' });

// Fetch volume and print it
xapi.Status.Audio.Volume
  .get()
  .then((volume) => { console.log(volume); });

// Set a configuration
xapi.Config.SystemUnit.Name.set('My System');

// Listen to feedback
const off = xapi.Event.Standby.on((event) => {
  // ...
});

// De-register feedback
off();
```

### Old style API

```javascript
// Set up a call
xapi.command('Dial', { Number: 'user@example.com' });

// Fetch volume and print it
xapi.status
  .get('Audio Volume')
  .then((volume) => { console.log(volume); });

// Set a configuration
xapi.config.set('SystemUnit Name', 'My System');

// Listen to feedback
const off = xapi.event.on('Standby', (event) => {
  // ...
});

// De-register feedback
off();
```

## Documentation

The full API documentation can be built by running `npm install` in a `jsxapi`
module directory. Documentation will be located under `docs/` can then be opened
in a browser.

More specifically:

```
mkdir tmp
cd tmp
npm install jsxapi
cd node_modules/jsxapi
npm install
```

Then open `./docs/index.html`.

## Questions and support?

Questions about the xAPI, integrations and customizations? Join the xAPI Devs
Spark Space community for realtime support [here](https://eurl.io/#rkp76XDrG).

## Development & Contribution

### Release procedure

Making a release is quite simple:

 * Perform all changes/commits.
 * Determine the version change (`npm help semver`).
 * Update "CHANGELOG.md" with version number, date and change summary.
 * Run `npm version` with the appropriate version bump.
 * Run `npm publish` to push the package version to the registry.
