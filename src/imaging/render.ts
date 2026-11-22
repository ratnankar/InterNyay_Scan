import {
  AlphaType,
  ColorType,
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkSurface,
} from '@shopify/react-native-skia'
import { File } from 'expo-file-system'
import { findDocumentQuad, rgbaToGray } from './autoCrop'
import { adjustmentToParams, colorMatrix, filterColorParams, type FilterId } from './filters'
import { isFullQuad, quadSize, rectQuad, scaleQuad, solveHomography, toColumnMajor, type Quad } from './geometry'

export type PageParams = {
  sourceUri: string
  width: number
  height: number
  quad: Quad | null
  rotation: 0 | 90 | 180 | 270
  filter: FilterId
  brightness: number
  contrast: number
}

export type Rendered = { base64: string; width: number; height: number }

const WARP = Skia.RuntimeEffect.Make(`
uniform shader src;
uniform float3x3 H;
half4 main(float2 xy) {
  float3 p = H * float3(xy, 1.0);
  return src.eval(p.xy / p.z);
}
`)

const DOCUMENT = Skia.RuntimeEffect.Make(`
uniform shader src;
uniform shader bg;
uniform float scale;
uniform float gain;
uniform float bw;
half4 main(float2 xy) {
  half4 c = src.eval(xy);
  half4 b = bg.eval(xy / scale);
  half3 n = clamp(c.rgb / max(b.rgb, half3(0.04)), 0.0, 1.0);
  n = pow(n, half3(half(gain)));
  if (bw > 0.5) {
    half g = dot(n, half3(0.299, 0.587, 0.114));
    g = smoothstep(0.45, 0.72, g);
    n = half3(g);
  }
  return half4(n, 1.0);
}
`)

const cache = new Map<string, SkImage>()
const CACHE_LIMIT = 3

export async function loadImage(uri: string): Promise<SkImage> {
  const hit = cache.get(uri)
  if (hit) {
    cache.delete(uri)
    cache.set(uri, hit)
    return hit
  }
  const base64 = await new File(uri).base64()
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64))
  if (!image) throw new Error('This image could not be read.')
  cache.set(uri, image)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
  return image
}

export function forgetImage(uri: string) {
  cache.delete(uri)
}

export function clearImageCache() {
  cache.clear()
}

function makeSurface(width: number, height: number): SkSurface {
  const surface = Skia.Surface.MakeOffscreen(Math.max(1, width), Math.max(1, height))
  if (!surface) throw new Error('Not enough memory to process this page.')
  return surface
}

function snapshot(surface: SkSurface): SkImage {
  surface.flush()
  return surface.makeImageSnapshot()
}

function geometryPass(image: SkImage, quad: Quad | null, outW: number, outH: number): SkImage {
  const surface = makeSurface(outW, outH)
  const canvas = surface.getCanvas()
  const paint = Skia.Paint()
  paint.setAntiAlias(true)
  const rect = Skia.XYWHRect(0, 0, outW, outH)

  if (quad && WARP) {
    const h = solveHomography(rectQuad(outW, outH), quad)
    const src = image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None)
    paint.setShader(WARP.makeShaderWithChildren(toColumnMajor(h), [src]))
    canvas.drawRect(rect, paint)
  } else {
    const matrix = Skia.Matrix()
    matrix.scale(outW / image.width(), outH / image.height())
    paint.setShader(image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.Linear, matrix))
    canvas.drawRect(rect, paint)
  }
  return snapshot(surface)
}

function backgroundEstimate(image: SkImage, scale: number): SkImage {
  const w = Math.max(1, Math.round(image.width() / scale))
  const h = Math.max(1, Math.round(image.height() / scale))
  const surface = makeSurface(w, h)
  const canvas = surface.getCanvas()
  const paint = Skia.Paint()
  const matrix = Skia.Matrix()
  matrix.scale(1 / scale, 1 / scale)
  paint.setShader(image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.Linear, matrix))
  paint.setImageFilter(
    Skia.ImageFilter.MakeBlur(3, 3, TileMode.Clamp, Skia.ImageFilter.MakeDilate(4, 4, null)),
  )
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint)
  return snapshot(surface)
}

function filterPass(image: SkImage, filter: FilterId): SkImage {
  const width = image.width()
  const height = image.height()

  if ((filter === 'document' || filter === 'bw') && DOCUMENT) {
    const scale = Math.max(2, Math.round(Math.max(width, height) / 300))
    const bg = backgroundEstimate(image, scale)
    const surface = makeSurface(width, height)
    const canvas = surface.getCanvas()
    const paint = Skia.Paint()
    const src = image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None)
    const bgShader = bg.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None)
    const gain = filter === 'bw' ? 1.4 : 1.7
    paint.setShader(DOCUMENT.makeShaderWithChildren([scale, gain, filter === 'bw' ? 1 : 0], [src, bgShader]))
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint)
    return snapshot(surface)
  }

  const params = filterColorParams(filter)
  if (!params) return image
  const surface = makeSurface(width, height)
  const canvas = surface.getCanvas()
  const paint = Skia.Paint()
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(colorMatrix(params.brightness, params.contrast, params.saturation)))
  canvas.drawImage(image, 0, 0, paint)
  return snapshot(surface)
}

function finalPass(image: SkImage, rotation: 0 | 90 | 180 | 270, brightness: number, contrast: number): SkImage {
  const adjust = adjustmentToParams(brightness, contrast)
  const needsAdjust = brightness !== 0 || contrast !== 0
  if (rotation === 0 && !needsAdjust) return image

  const swap = rotation === 90 || rotation === 270
  const w = swap ? image.height() : image.width()
  const h = swap ? image.width() : image.height()
  const surface = makeSurface(w, h)
  const canvas = surface.getCanvas()
  const paint = Skia.Paint()
  if (needsAdjust) paint.setColorFilter(Skia.ColorFilter.MakeMatrix(colorMatrix(adjust.b, adjust.c, 1)))

  canvas.save()
  if (rotation === 90) {
    canvas.translate(w, 0)
    canvas.rotate(90, 0, 0)
  } else if (rotation === 180) {
    canvas.translate(w, h)
    canvas.rotate(180, 0, 0)
  } else if (rotation === 270) {
    canvas.translate(0, h)
    canvas.rotate(270, 0, 0)
  }
  canvas.drawImage(image, 0, 0, paint)
  canvas.restore()
  return snapshot(surface)
}

export async function renderPage(params: PageParams, maxEdge: number, jpegQuality: number): Promise<Rendered> {
  const source = await loadImage(params.sourceUri)
  const full = !params.quad || isFullQuad(params.quad, source.width(), source.height())
  const quad = full ? null : params.quad
  const size = quad ? quadSize(quad) : { width: source.width(), height: source.height() }
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height))
  const outW = Math.max(1, Math.round(size.width * scale))
  const outH = Math.max(1, Math.round(size.height * scale))

  const geometry = geometryPass(source, quad, outW, outH)
  const filtered = filterPass(geometry, params.filter)
  const result = finalPass(filtered, params.rotation, params.brightness, params.contrast)

  return {
    base64: result.encodeToBase64(ImageFormat.JPEG, jpegQuality),
    width: result.width(),
    height: result.height(),
  }
}

export async function renderToFile(
  params: PageParams,
  maxEdge: number,
  jpegQuality: number,
  destination: File,
): Promise<{ uri: string; width: number; height: number }> {
  const rendered = await renderPage(params, maxEdge, jpegQuality)
  if (destination.exists) destination.delete()
  destination.create()
  await destination.write(rendered.base64, { encoding: 'base64' })
  return { uri: destination.uri, width: rendered.width, height: rendered.height }
}

export async function detectQuad(uri: string): Promise<Quad | null> {
  const image = await loadImage(uri)
  const sw = 220
  const sh = Math.max(1, Math.round((image.height() / image.width()) * sw))
  const surface = makeSurface(sw, sh)
  const canvas = surface.getCanvas()
  const paint = Skia.Paint()
  const matrix = Skia.Matrix()
  matrix.scale(sw / image.width(), sh / image.height())
  paint.setShader(image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.Linear, matrix))
  paint.setImageFilter(Skia.ImageFilter.MakeBlur(1.2, 1.2, TileMode.Clamp, null))
  canvas.drawRect(Skia.XYWHRect(0, 0, sw, sh), paint)
  const small = snapshot(surface)
  const pixels = small.readPixels(0, 0, {
    width: sw,
    height: sh,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  })
  if (!pixels) return null
  const quad = findDocumentQuad(rgbaToGray(pixels as ArrayLike<number>, sw, sh), sw, sh)
  if (!quad) return null
  return scaleQuad(quad, image.width() / sw, image.height() / sh)
}
