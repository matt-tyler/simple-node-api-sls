import { DefaultApi } from "../src/api";
import axios from "axios";
import { createHash } from "crypto";
import { URL } from "url"
import { Config } from "aws-sdk"

const aws4 = require('aws4');

function hash(string: string) {
    return createHash('sha256').update(string, 'utf8').digest('hex')
}

describe("Test My API: Create 3 messages", () => {
    const instance = axios.create()

    instance.interceptors.request.use(async (config) => { 
        const { credentials: {
            accessKeyId, secretAccessKey
        }} = new Config();

        const url = new URL(config.url);
        const data = config.data ? config.data : "";

        const headers: { [key: string]: string }[] = [
            { 'X-Amz-Content-Sha256': hash(data) },
        ];

        if (!new Set(['OPTIONS', 'GET']).has(config.method.toUpperCase())) {
            headers.push({ 'Content-Type': config.headers['Content-Type'] })
        }
    
        const req = aws4.sign({
            service: 'execute-api',
            region: 'ap-southeast-2',
            method: config.method.toUpperCase(),
            path: `${url.pathname}${url.search}`,
            headers: Object.assign({}, ...headers),
            body: data,
            host: url.host
        }, { accessKeyId, secretAccessKey });

        config.headers = req.headers;
        return config
    })

    const api = new DefaultApi({},
        process.env["ENDPOINT"],
        instance
    );

    const messages = [
        "message 1",
        "message 2",
        "message 3"
    ];

    beforeEach(async (done) => {
        for (const message of messages) {
            try {
                await api.createMessage(message);
            } catch (err) {
                console.log(err)
                done.fail(err)
                return;
            }
        }
        done();
    });

    it("should return messages", async (done) => {
        const { data } = await api.listMessages(3);
        expect(data.items.length).toBe(3);
        expect(data.items).toEqual(
            expect.arrayContaining(
                messages.map(message => expect.objectContaining({
                    message,
                    author: expect.anything(),
                    time: expect.anything()
                }))
            ));
        done();
    });
})