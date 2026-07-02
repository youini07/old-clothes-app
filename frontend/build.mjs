import { build } from 'vite';

build().catch(err => {
    console.error('BUILD ERROR CAUGHT:');
    console.error(err);
    process.exit(1);
});
