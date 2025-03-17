import module from 'module';
const require = module.createRequire(import.meta.filename);

const {commitAndPush} = require('cmd-util');

commitAndPush('更新脚本');
