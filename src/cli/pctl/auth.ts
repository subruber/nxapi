import type { Arguments as ParentArguments } from '../pctl.js';
import createDebug from '../../util/debug.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getPctlToken } from '../../common/auth/moon.js';
import { NintendoAccountSessionAuthorisationMoon } from '../../api/moon.js';
import prompt from '../util/prompt.js';

const debug = createDebug('cli:pctl:auth');

export const command = 'auth';
export const desc = 'Generate a link to login to a Nintendo Account';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('auth', {
        describe: 'Authenticate immediately',
        type: 'boolean',
        default: true,
    }).option('select', {
        describe: 'Set as default user (default: true if only user)',
        type: 'boolean',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    const authenticator = NintendoAccountSessionAuthorisationMoon.create();

    debug('Authentication parameters', authenticator);

    console.log('1. Open this URL and login to your Nintendo Account:');
    console.log('');
    console.log(authenticator.authorise_url);
    console.log('');

    console.log('2. On the "Linking an External Account" page, right click "Select this person" and copy the link. It should start with "npf54789befb391a838://auth".');
    console.log('');

    const applink = await prompt({
        prompt: `Paste the link: `,
    });

    console.log('');

    const authorisedurl = new URL(applink);
    const authorisedparams = new URLSearchParams(authorisedurl.hash.substr(1));
    debug('Redirect URL parameters', [...authorisedparams.entries()]);

    const token = await authenticator.getSessionToken(authorisedparams);

    console.log('Session token', token);

    if (argv.auth) {
        const storage = await initStorage(argv.dataPath);

        const {moon, data} = await getPctlToken(storage, token.session_token);

        console.log('Authenticated as Nintendo Account %s (%s)',
            data.user.nickname, data.user.id);

        await storage.setItem('NintendoAccountToken-pctl.' + data.user.id, token.session_token);

        const users = new Set(await storage.getItem('NintendoAccountIds') ?? []);
        users.add(data.user.id);
        await storage.setItem('NintendoAccountIds', [...users]);

        if ('select' in argv ? argv.select : users.size === 1) {
            await storage.setItem('SelectedUser', data.user.id);

            console.log('Set as default user');
        }
    }
}
