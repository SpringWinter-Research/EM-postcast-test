import { z } from 'zod'

import {topics,languages,formats} from './reference'
export {topics,languages,formats} from './reference'
const choices = (values: string[]) => z.array(z.string().refine(value => values.includes(value))).min(1).transform(values => [...new Set(values)])
export const role = z.enum(['host', 'guest'])
export const name = z.string().trim().min(1).max(120)
export const note = z.string().trim().min(1).max(2000)
export const publicUrl = z.url({protocol: /^https?$/})
const matchFields = {
  topics: choices(topics),
  languages: choices(languages),
  formats: choices(formats),
}
export const profile = z.object({name})
export const guest = profile.extend({bio: note, ...matchFields})
export const podcast = profile.extend({description: note, url: publicUrl, open: z.boolean(), ...matchFields})
export const listing = podcast.extend({bio:note}).partial()
const empty = z.literal('')
const emptyList = z.tuple([])
export const hostDraft = profile.extend({name:name.or(empty)}).partial()
export const guestDraft = guest.extend({
  name:name.or(empty), bio:note.or(empty),
  topics:matchFields.topics.or(emptyList), languages:matchFields.languages.or(emptyList), formats:matchFields.formats.or(emptyList),
}).partial()
export const podcastDraft = podcast.extend({
  name:name.or(empty), description:note.or(empty), url:publicUrl.or(empty),
  topics:matchFields.topics.or(emptyList), languages:matchFields.languages.or(emptyList), formats:matchFields.formats.or(emptyList),
}).partial()
export const id = z.uuid()
export const requestInput = z.object({
  direction: z.enum(['application', 'invitation']),
  podcastId: id,
  guestId: id.optional(),
  message: note,
  startsAt: z.iso.datetime({offset: true}),
  timezone: z.string().refine(value => {
    try { new Intl.DateTimeFormat('en', {timeZone: value}); return true } catch { return false }
  }),
})
export const confirmation = z.object({
  date: z.iso.date().refine(value => value <= new Date().toISOString().slice(0, 10)),
  type: z.enum(['episode', 'statements']),
  note,
  url: publicUrl.optional(),
}).refine(value => value.type === 'statements' || Boolean(value.url))
export function score(show: z.infer<typeof podcast>, person: z.infer<typeof guest>) {
  const topics = show.topics.filter(topic => person.topics.includes(topic))
  const languages = show.languages.filter(language => person.languages.includes(language))
  const formats = show.formats.filter(format => person.formats.includes(format))
  if (!topics.length || !languages.length) return null
  return {score: Math.round(70 * topics.length / show.topics.length + 20 * languages.length / show.languages.length + (formats.length ? 10 : 0)), topics, languages, formats}
}
