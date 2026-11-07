// Run with `swift assets/generate.swift` on macOS to redraw the app artwork.
import AppKit

let cream = NSColor(calibratedRed: 1.0, green: 0.98, blue: 0.92, alpha: 1)
let yellow = NSColor(calibratedRed: 0.97, green: 0.74, blue: 0.13, alpha: 1)
let red = NSColor(calibratedRed: 0.72, green: 0.14, blue: 0.10, alpha: 1)
let ink = NSColor(calibratedRed: 0.17, green: 0.11, blue: 0.10, alpha: 1)

func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ color: NSColor, radius: CGFloat = 0) {
  color.setFill()
  NSBezierPath(roundedRect: NSRect(x: x, y: y, width: w, height: h), xRadius: radius, yRadius: radius).fill()
}

func oval(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ color: NSColor) {
  color.setFill()
  NSBezierPath(ovalIn: NSRect(x: x, y: y, width: w, height: h)).fill()
}

func meterArc(_ cx: CGFloat, _ cy: CGFloat, _ radius: CGFloat, _ start: CGFloat, _ end: CGFloat, _ width: CGFloat, _ color: NSColor) {
  let arc = NSBezierPath()
  arc.appendArc(withCenter: NSPoint(x: cx, y: cy), radius: radius, startAngle: start, endAngle: end, clockwise: true)
  arc.lineWidth = width
  arc.lineCapStyle = .round
  color.setStroke()
  arc.stroke()
}

func text(_ value: String, _ x: CGFloat, _ y: CGFloat, size: CGFloat, color: NSColor, font: String = "AvenirNextCondensed-Heavy", tracking: CGFloat = 0) {
  let f = NSFont(name: font, size: size) ?? NSFont.boldSystemFont(ofSize: size)
  value.draw(at: NSPoint(x: x, y: y), withAttributes: [
    .font: f, .foregroundColor: color, .kern: tracking,
  ])
}

func cigarette(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat) {
  // This intentionally reads as a sticker, not a realistic tobacco product.
  rect(x - 10, y - 10, width + 20, height + 20, ink, radius: height * 0.27)
  rect(x, y, width, height, cream, radius: height * 0.14)
  rect(x + width * 0.73, y, width * 0.27, height, yellow)
  rect(x + width * 0.73, y, width * 0.04, height, red)
  rect(x + width * 0.88, y + 4, width * 0.025, height - 8, red)
  oval(x - 23, y + height * 0.36, 19, height * 0.27, red)
}

func render(width: Int, height: Int, path: String, draw: () -> Void) {
  let image = NSImage(size: NSSize(width: width, height: height))
  image.lockFocus()
  NSGraphicsContext.current?.imageInterpolation = .high
  draw()
  image.unlockFocus()
  guard let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let source = bitmap.cgImage,
        let context = CGContext(data: nil, width: width, height: height,
                                bitsPerComponent: 8, bytesPerRow: 0,
                                space: CGColorSpaceCreateDeviceRGB(),
                                bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { fatalError("Could not make bitmap") }
  context.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))
  guard let opaque = context.makeImage(),
        let png = NSBitmapImageRep(cgImage: opaque).representation(using: .png, properties: [:]) else { fatalError("Could not make PNG") }
  try! png.write(to: URL(fileURLWithPath: path))
}

render(width: 1024, height: 1024, path: "assets/icon.png") {
  rect(0, 0, 1024, 1024, yellow)
  rect(102, 82, 834, 850, ink, radius: 178)
  rect(88, 100, 834, 850, red, radius: 178)
  rect(104, 120, 800, 816, cream, radius: 160)
  meterArc(505, 440, 285, 205, -25, 86, ink)
  meterArc(505, 440, 285, 205, -25, 65, yellow)
  meterArc(505, 440, 285, 205, 39, 65, red)
  for i in 0...5 {
    let degrees = CGFloat(205 - i * 46) * .pi / 180
    let inner = NSPoint(x: 505 + cos(degrees) * 225, y: 440 + sin(degrees) * 225)
    let outer = NSPoint(x: 505 + cos(degrees) * 247, y: 440 + sin(degrees) * 247)
    let tick = NSBezierPath()
    tick.move(to: inner)
    tick.line(to: outer)
    tick.lineWidth = 12
    tick.lineCapStyle = .round
    ink.setStroke()
    tick.stroke()
  }
  let needle = NSBezierPath()
  needle.move(to: NSPoint(x: 474, y: 420))
  needle.line(to: NSPoint(x: 688, y: 636))
  needle.line(to: NSPoint(x: 532, y: 402))
  needle.close()
  ink.setFill()
  needle.fill()
  oval(461, 394, 90, 90, ink)
  oval(483, 416, 46, 46, red)
  text("P/O", 328, 196, size: 125, color: ink, tracking: 2)
}

render(width: 1284, height: 2778, path: "assets/splash.png") {
  rect(0, 0, 1284, 2778, cream)
  rect(0, 0, 1284, 208, red)
  text("PUFF-O-", 92, 2300, size: 231, color: red, tracking: -7)
  text("METER", 92, 2035, size: 286, color: red, tracking: -7)
  text("THE WAIT IS THE POINT.", 102, 1926, size: 50, color: ink, tracking: 4)
  oval(-220, 758, 1650, 1040, yellow)
  cigarette(x: 132, y: 1160, width: 1020, height: 142)
  oval(183, 1485, 134, 134, red)
  oval(354, 1570, 80, 80, red)
  oval(484, 1630, 47, 47, red)
  text("PLAN IT. DO IT. CHILL.", 86, 395, size: 72, color: red, tracking: 2)
  text("YOUR PACE. YOUR CALL.", 90, 297, size: 43, color: ink, tracking: 3)
  text("PUFF-O-METER", 85, 100, size: 72, color: cream, tracking: 2)
}
