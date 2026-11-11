'use strict'

const fs = require('node:fs')
const path = require('node:path')
const nextDir = [path.join(__dirname, 'apps/puzzled/.next'), path.join(__dirname, '.next')]
	.find((dir) => fs.existsSync(path.join(dir, 'required-server-files.json')))
const assetPrefix = nextDir ? JSON.parse(fs.readFileSync(path.join(nextDir, 'required-server-files.json'), 'utf8')).config.assetPrefix : ''
require('./shared-home-server.cjs').installSharedHome({ staticDir: path.join(nextDir ?? __dirname, 'static'), assetPrefix })
