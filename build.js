let path = require("path");
let { rollup } = require("rollup");
let babel = require("rollup-plugin-babel");
let { uglify } = require("rollup-plugin-uglify");

rollup({
	input: path.resolve(__dirname, "./src/index.js"),
	plugins: [
		babel({
			exclude: "node_modules/**"
		}),
		uglify()
	]
}).then(function(bundle) {
	bundle.write({
		file: path.resolve(__dirname, "./dist/index.js"),
		name: "axios-fetch-client",
		format: "umd"
	});
});