import request from 'supertest'
import mongoose from 'mongoose'

import app from './app'
import config, { getMongoUri } from './config'
import { Thread, IThread } from './models/thread.model'
import { Reply } from './models/reply.model'

function isToday(date: string) {
  const today = new Date().toLocaleDateString()
  const testDate = new Date(date).toLocaleDateString()
  return today === testDate
}

describe('Functional Tests', () => {
  let testThread: any
  let testThread2: any
  let threadToDeleteWin: any
  let threadToDeleteFail: any

  beforeAll(async done => {
    const url = getMongoUri('functional-tests')
    await mongoose.connect(url, config.mongoose.options)

    // create testing thread
    const { body: a } = await request(app)
      .post('/api/threads/board-test')
      .send({
        text: 'Thread test text for replies keep A',
        password: 's3cr3t',
      })
    testThread = a
    const { body: b } = await request(app)
      .post('/api/threads/board-test')
      .send({
        text: 'Thread test text for replies keep B',
        password: 's3cr3t',
      })
    testThread2 = b
    const { body: c } = await request(app)
      .post('/api/threads/board-test')
      .send({
        text: 'Thread will be successful deleted',
        password: 's3cr3t',
      })
    threadToDeleteWin = c
    const { body: d } = await request(app)
      .post('/api/threads/board-test')
      .send({
        text: 'Thread will failing to delete',
        password: 's3cr3t',
      })
    threadToDeleteFail = d

    async function createReply(i: number) {
      await request(app)
        .post('/api/replies/board-test')
        .send({
          text: `reply text ${i}`,
          password: 's3cr3t',
          threadId: testThread2._id,
        })
    }

    for (let i = 0; i < 6; i++) {
      await createReply(i)
    }
    done()
  })

  afterAll(async done => {
    // Delete all Threads except text contain "keep" word
    // const regex = new RegExp(/^(.(?!(keep)))*$/)
    await Thread.deleteMany({})
    await Reply.deleteMany({})
    done()
  })

  describe('API ROUTING FOR /api/threads/:board', () => {
    describe('POST', () => {
      test('should works with text & password', async done => {
        const res = await request(app).post('/api/threads/board-test').send({
          text: 'Thread test text',
          password: 's3cr3t',
        })

        expect(res.status).toEqual(201)
        expect(res.body.text).toEqual('Thread test text')
        expect(res.body.password).toEqual('s3cr3t')
        expect(res.body).toHaveProperty('_id')
        expect(res.body).toHaveProperty('createdAt')
        expect(res.body).toHaveProperty('bumpedAt')
        expect(res.body.reported).toBeFalsy()
        expect(Array.isArray(res.body.replies)).toBe(true)
        expect(res.body.replies).toBeArray()
        done()
      })

      test('should return an error if text missing', async done => {
        const res = await request(app).post('/api/threads/board-test').send({
          password: 's3cr3t',
        })

        expect(res.status).toEqual(200)
        expect(res.body.errors.text.properties.message).toEqual(
          'Path `text` is required.',
        )
        done()
      })

      test('should return an error if password missing', async done => {
        const res = await request(app).post('/api/threads/board-test').send({
          text: 'Thread test text',
        })

        expect(res.status).toEqual(200)
        expect(res.body.errors.password.properties.message).toEqual(
          'Path `password` is required.',
        )
        done()
      })
    })

    describe('GET', () => {
      test('Should return an array of 10 threads max', async done => {
        const res = await request(app).get('/api/threads/board-test')

        expect(res.status).toEqual(200)
        expect(res.body.length).toBeLessThanOrEqual(10)
        expect(res.body[0]).toHaveProperty('_id')
        expect(res.body[0]).not.toHaveProperty('password')
        expect(res.body[0]).not.toHaveProperty('reported')

        done()
      })

      test('Each thread must contains max 3 items', async done => {
        const res = await request(app).get('/api/threads/board-test')

        expect(res.body[0]).toHaveProperty('replies')

        res.body.forEach((thread: IThread) => {
          expect(thread.replies.length).toBeLessThanOrEqual(3)
        })
        done()
      })

      test("Should return an empty array if haven't thread", async done => {
        const res = await request(app).get('/api/threads/board-un-exists')

        expect(res.status).toEqual(200)
        expect(res.body.length).toBeLessThanOrEqual(0)

        done()
      })

      test('Should return the full thread if threadId passed', async done => {
        const url = `/api/threads/board-test?threadId=${testThread2._id}`
        const res = await request(app).get(url)

        expect(res.status).toEqual(200)
        expect(res.body).toBeArrayOfSize(1)
        expect(res.body[0].replies.length).toBeGreaterThanOrEqual(5)

        expect(res.body[0]).toHaveProperty('_id')
        expect(res.body[0]).not.toHaveProperty('password')
        expect(res.body[0]).not.toHaveProperty('reported')

        done()
      })
    })

    describe('DELETE', () => {
      test('I can delete a thread with password & _id', async done => {
        const res = await request(app).delete('/api/threads/board-test').send({
          password: threadToDeleteWin.password,
          threadId: threadToDeleteWin._id,
        })

        expect(res.body.message).toEqual('thread successful deleted')
        done()
      })

      test("I can't delete a thread if password missing", async done => {
        console.log(threadToDeleteFail)
        const res = await request(app)
          .delete('/api/threads/board-test')
          .send({ threadId: threadToDeleteFail._id })

        expect(res.body.message).toEqual('incorrect password')
        done()
      })

      test("I can't delete a thread if password wrong", async done => {
        const res = await request(app).delete('/api/threads/board-test').send({
          password: 'wrong-password',
          threadId: threadToDeleteFail._id,
        })

        expect(res.body.message).toEqual('incorrect password')
        done()
      })

      test("I can't delete a thread if doesn't exists", async done => {
        const res = await request(app)
          .delete('/api/threads/board-test')
          .send({ password: 'test', threadId: 'abcdef' })

        expect(res.body.message).toEqual('incorrect password')
        done()
      })
    })

    // describe('PUT', () => {})
  })

  describe('API ROUTING FOR /api/replies/:board', () => {
    describe('POST', () => {
      test('should throw error if text is missing', async done => {
        const res = await request(app).post('/api/replies/board-test').send({
          password: 's3cr3t',
          threadId: testThread._id,
        })

        expect(res.status).toEqual(200)
        expect(res.body.errors.text.properties.message).toEqual(
          'Path `text` is required.',
        )
        done()
      })

      test('should throw error if password is missing', async done => {
        const res = await request(app).post('/api/replies/board-test').send({
          text: 'reply text',
          threadId: testThread._id,
        })

        expect(res.status).toEqual(200)
        expect(res.body.errors.password.properties.message).toEqual(
          'Path `password` is required.',
        )
        done()
      })

      test('should throw error if threadId is missing', async done => {
        const res = await request(app).post('/api/replies/board-test').send({
          text: 'reply text houhou',
          password: 's3cr3t',
        })

        expect(res.body.message).toEqual('Thread id is missing')
        done()
      })

      test('should throw error if threadId un-exists', async done => {
        const fakeId = `0f01cbab2ab94d1650a062b3`
        const res = await request(app).post('/api/replies/board-test').send({
          text: 'reply text houhou',
          password: 's3cr3t',
          threadId: fakeId,
        })

        expect(res.body.message).toEqual('Thread does not exist')
        done()
      })

      test('should works with text, password & existing threadId', async done => {
        const res = await request(app).post('/api/replies/board-test').send({
          text: 'reply text',
          password: 's3cr3t',
          threadId: testThread._id,
        })

        const firstReply = res.body.replies[0]

        expect(res.status).toEqual(201)

        // it will also update the bumped_on date to the comments date
        expect(isToday(res.body.bumpedAt)).toBeTruthy()

        // In the thread's replies array will be saved
        expect(res.body.replies).toBeArrayOfSize(1)
        expect(firstReply).toHaveProperty('_id')
        expect(firstReply).toHaveProperty('createdAt')
        expect(firstReply.text).toEqual('reply text')
        expect(firstReply.password).toEqual('s3cr3t')
        expect(firstReply.reported).toBeFalsy()

        done()
      })
    })

    //     describe('GET', () => {})

    //     describe('PUT', () => {})

    //     describe('DELETE', () => {})
  })
})
