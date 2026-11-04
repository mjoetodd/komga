/** A book's audiobook voice cast, served from its `.cast.json` sidecar. */
export interface CastMember {
  id: string
  name: string
  description?: string | null
  voice: string
  voiceType: string
  dialogueSegments: number
  dialogueChars: number
}

export interface BookCast {
  available: boolean
  series?: string | null
  narrator?: CastMember | null
  cast: CastMember[]
}
