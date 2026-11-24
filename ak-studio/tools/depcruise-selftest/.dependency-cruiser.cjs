// Same rules and options as the real config (including the swc parser), minus the tsConfig file,
// which does not exist inside the fixture.
const real = require("../../.dependency-cruiser.cjs");

module.exports = {
	forbidden: real.forbidden,
	options: { ...real.options, tsConfig: undefined },
};
