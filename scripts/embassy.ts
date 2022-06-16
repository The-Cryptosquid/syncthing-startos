import matches from "https://deno.land/x/ts_matches@5.1.5/mod.ts";
const { shape, number, string, some, literal } = matches;

import {
  Config,
  Effects,
  ExpectedExports,
  Properties,
} from "./types.d.ts";

const matchesStringRec = some(
  string,
  shape(
    {
      charset: string,
      len: number,
    },
    ["charset"],
  ),
);
const matchesConfig = shape({
  username: matchesStringRec,
  password: matchesStringRec,
});

const matchesConfigFile = shape({
  username: string,
  password: string,
});

export const getConfig: ExpectedExports.getConfig = async (
  effects: Effects,
) => {
  const config = await effects
    .readJsonFile({
      volumeId: "main",
      path: "config.json",
    })
    .then((x) => matchesConfig.unsafeCast(x))
    .catch(() => undefined);

  return {
    result: {
      config,
      spec: {
        "tor-address": {
          name: "Tor Address",
          description: "The Tor address.",
          type: "pointer",
          subtype: "package",
          "package-id": "syncthing",
          target: "tor-address",
          interface: "main",
        },
        username: {
          type: "string",
          name: "Username",
          description:
            "The user for loging into the administration page of syncthing",
          nullable: false,
          copyable: true,
          masked: false,
          default: "admin",
        },
        password: {
          type: "string",
          name: "Password",
          description:
            "The password for loging into the administration page of syncthing",
          nullable: false,
          copyable: true,
          masked: true,
          default: {
            charset: "a-z,A-Z,0-9",
            len: 22,
          },
        },
      },
    },
  };
};

export const setConfig: ExpectedExports.setConfig = async (
  effects: Effects,
  input: Config,
) => {
  await effects.writeJsonFile({
    path: "./config.json",
    toWrite: {
      username: input?.username,
      password: input?.password,
    },
    volumeId: "main",
  });
  return {
    result: {
      signal: "SIGTERM",
      "depends-on": {},
    },
  };
};

const matchesSyncthingSystem = shape({
  myID: string,
});

export const properties: ExpectedExports.properties = async (effects) => {
  const syncthing_system_promise = effects.readJsonFile({
    volumeId: "main",
    path: "syncthing_stats.json",
  });
  const config_promise = effects.readJsonFile({
    volumeId: "main",
    path: "config.json",
  });

  const syncthing_system = matchesSyncthingSystem.unsafeCast(
    await syncthing_system_promise,
  );
  const config = matchesConfigFile.unsafeCast(await config_promise);

  const result: Properties = {
    version: 2,
    data: {
      "Device Id": {
        type: "string",
        value: syncthing_system.myID,
        description: "his is the ID for syncthing to attach others to",
        copyable: true,
        qr: true,
        masked: false,
      },
      Username: {
        type: "string",
        value: config.username,
        description: "Username to login to the UI",
        copyable: true,
        qr: false,
        masked: false,
      },
      Password: {
        type: "string",
        value: config.password,
        description: "Password to login to the UI",
        copyable: true,
        qr: false,
        masked: true,
      },
    },
  };
  return { result };
};
const parsableInt = string.map(Number).refine(function isInt(x): x is number { return Number.isInteger(x) })
const okRegex = /Ok:.+/
const errorRegex = /Error:\s?(.+)/
export const health: ExpectedExports.health = {
  async version(effects) {
    try {
      const version = await effects.readFile({
        volumeId: "main",
        path: "./health-version",
      }).then(x => x.trim());
      const result = matches(version)
        .when(parsableInt, () => ({
          result: null,
        }))
        .when(literal('read'), () => ({
          'error': "Health has not ran recent enough",
        }))
        .defaultTo({
          'error-code': [61, `No catching: ${JSON.stringify(version)}`] as const,
        });
      await effects.writeFile({
        volumeId: "main",
        toWrite: "read",
        path: "health-version",
      })
      return result;
    }
    catch (e) {
      effects.error(`Health check failed: ${e}`);
      return {
        'error-code': [61, "No file indicating health has ran"] as const,
      }

    }
  },
  async "web-ui"(effects) {
    try {
      const fileContents = await effects.readFile({
        volumeId: "main",
        path: "./health-web",
      }).then(x => x.trim());
      const result = matches(fileContents)
        .when(literal('read'), () => ({
          'error': "Health has not ran recent enough",
        }))
        .when(string, (x) => {
          if (okRegex.test(x)) {
            return {
              result: null,
            };
          }
          const errorExec = errorRegex.exec(x);
          if (errorExec) {
            return {
              error: errorExec[1],
            }
          }
          return {
            error: `Unknown file contents: ${x}`
          }
        })
        .defaultTo({
          'error-code': [61, `No catching: ${JSON.stringify(fileContents)}`] as const,
        });
      await effects.writeFile({
        volumeId: "main",
        toWrite: "read",
        path: "health-web",
      })
      return result;
    }
    catch (e) {
      effects.error(`Health check failed: ${e}`);
      return {
        'error-code': [61, "No file indicating health web has ran"] as const,
      }

    }
  }
}