const axios = require('axios')
const qs = require('querystring')
const md5 = require('blueimp-md5')

let signatureConfig = {}

/**
 * sinature
 */
const sign = function (data, key) {
	const keys = []
	for (let k in data) {
		if (data.hasOwnProperty(k)) {
			if (JSON.stringify(data[k]).length < 64) { // exclude value which very long
				keys.push(k)
			}
		}
	}
	let str = ''
	keys.sort()
	keys.forEach((key) => {
		str += (key + '=' + data[key] + '&')
	})
	str += 'key=' + key
	return md5(str).toUpperCase()
}


const excludes = ['/favicon.ico', '/api/anon']

let interceptorData = {}

const instance = axios.create({
	timeout: 6000,
	withCredentials: false,
	// headers: {
	// 	'Accept': 'application/json, text/plain, */*',
	// 	'Content-Type': 'application/json'
	// 	// 'Access-Control-Allow-Origin': '*'
	// },

	// transformResponse: [function(data) {
	// 	return JSON.parse(data);
	// }],

	// validateStatus: function (status) {
	// 	return status >= 200 && status < 300
	// }
});

/**
 * interceptor for request
 */
instance.interceptors.request.use((config) => {
	let need = true
	for (let exclude of excludes) {
		if (config.url.startsWith(exclude)) {
			need = false
			break
		}
	}

	if (need) {
		const timestamp = Date.now()

		// signature
		const signature = sign(
			Object.assign({v_user: interceptorData.user, v_timestamp: timestamp}, config.params),
			interceptorData.token
		)

		// headers
		config.headers = {
			v_token: interceptorData.token,
			v_signature: signature,
			v_timestamp: timestamp
		}
	}

	return config
}, (err) => {
	return Promise.reject(err);
});

/**
 * interceptor for response
 */
instance.interceptors.response.use((res) => {
	const data = res.data;
	if (data.status !== 22000) {
		return Promise.reject({status: data.status, body: data.body})
	}
	return data.body
	// return Promise.resolve({status: data.status, body: data.body, timestamp: Date.now()})
}, (err) => {
	let errorMessage = err.message
	let status = -1
	if (err.response) {
		status = err.response.status
		switch (err.response.status) {
			case 404: {
				errorMessage = '404 not found'
				break
			}
			case 500: {
				errorMessage = '500 internal error'
				break
			}
		}
	}
	return Promise.reject({status: status, body: errorMessage})
});

/**
 * fetch methods
 */
module.exports = {
	injectToInterceptor (user, token) {
		interceptorData = {user, token}
	},

	async raw(option) {
		return axios(option)
	},

	async request(option) {
		return await instance(option)
	},

	async get(url, params = {}) {
		return this.request({method: 'get', url, params})
	},

	async post(url, params = {}) {
		return this.request({method: 'post', url, data: params})
	},

	async put(url, params = {}) {
		return this.request({method: 'put', url, data: params})
	},

	async patch(url, params = {}) {
		return this.request({method: 'patch', url, data: params})
	},

	async delete(url, params = {}) {
		return this.request({method: 'delete', url, data: params})
	},

	async all(items) {
		if(!Array.isArray(items)) {
			if (typeof items !== 'object') {
				throw 'argument should be object or array.'
			}
			items = [items]
		}

		const task = []
		for(let item of items) {
			task.push(this.request(item))
		}
		return await axios.all(task)
	}
}
