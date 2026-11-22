import type { ComponentProps, Ref } from 'react'
import type { ScrollView, TextInput } from 'react-native'

type RefInstance<P> = P extends { ref?: Ref<infer I> | undefined } ? I : never

export type ScrollInstance = RefInstance<ComponentProps<typeof ScrollView>>
export type InputInstance = RefInstance<ComponentProps<typeof TextInput>>
