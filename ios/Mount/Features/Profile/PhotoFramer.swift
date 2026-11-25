import SwiftUI
import UIKit

/// Framing a profile photo: the picture behind a circle, pinched to size and
/// dragged into place. What's inside the circle becomes the icon.
struct PhotoFramer: View {
    let image: UIImage
    let onUse: (UIImage) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var scale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @GestureState private var pinch: CGFloat = 1
    @GestureState private var drag: CGSize = .zero

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                let side = min(proxy.size.width - 48, 320)
                let liveScale = clampScale(scale * pinch)
                let liveOffset = clamp(CGSize(width: offset.width + drag.width, height: offset.height + drag.height),
                                       side: side, scale: liveScale)
                ZStack {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: baseSize(side).width * liveScale, height: baseSize(side).height * liveScale)
                        .offset(liveOffset)
                    // Everything outside the circle dims.
                    Rectangle()
                        .fill(Color.black.opacity(0.55))
                        .reverseMask { Circle().frame(width: side, height: side) }
                        .allowsHitTesting(false)
                    Circle()
                        .strokeBorder(Zoe.ink.opacity(0.6), lineWidth: 1)
                        .frame(width: side, height: side)
                        .allowsHitTesting(false)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .clipped()
                .gesture(
                    DragGesture()
                        .updating($drag) { value, state, _ in state = value.translation }
                        .onEnded { value in
                            offset = clamp(CGSize(width: offset.width + value.translation.width,
                                                  height: offset.height + value.translation.height),
                                           side: side, scale: scale)
                        }
                        .simultaneously(with: MagnifyGesture()
                            .updating($pinch) { value, state, _ in state = value.magnification }
                            .onEnded { value in
                                scale = clampScale(scale * value.magnification)
                                offset = clamp(offset, side: side, scale: scale)
                            })
                )
                .overlay(alignment: .bottom) {
                    Text("Pinch to zoom, drag to move").font(.footnote).foregroundStyle(Zoe.inkMuted).padding(.bottom, 24)
                }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Use photo") {
                            onUse(render(side: side))
                            dismiss()
                        }
                        .fontWeight(.semibold)
                    }
                }
            }
            .navigationTitle("Frame your photo")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color.black)
        }
    }

    /// The photo's size at scale 1: just filling the circle.
    private func baseSize(_ side: CGFloat) -> CGSize {
        let fill = side / min(image.size.width, image.size.height)
        return CGSize(width: image.size.width * fill, height: image.size.height * fill)
    }

    private func clampScale(_ value: CGFloat) -> CGFloat { min(max(value, 1), 5) }

    /// Keeps the photo covering the whole circle.
    private func clamp(_ proposed: CGSize, side: CGFloat, scale: CGFloat) -> CGSize {
        let size = baseSize(side)
        let maxX = max(0, (size.width * scale - side) / 2)
        let maxY = max(0, (size.height * scale - side) / 2)
        return CGSize(width: min(max(proposed.width, -maxX), maxX), height: min(max(proposed.height, -maxY), maxY))
    }

    /// The circle's square, cut from the photo at 400 by 400.
    private func render(side: CGFloat) -> UIImage {
        let displayed = CGSize(width: baseSize(side).width * scale, height: baseSize(side).height * scale)
        let toImage = image.size.width / displayed.width
        let crop = CGRect(
            x: (displayed.width / 2 - side / 2 - offset.width) * toImage,
            y: (displayed.height / 2 - side / 2 - offset.height) * toImage,
            width: side * toImage,
            height: side * toImage
        )
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let output: CGFloat = 400
        return UIGraphicsImageRenderer(size: CGSize(width: output, height: output), format: format).image { _ in
            let factor = output / crop.width
            image.draw(in: CGRect(x: -crop.minX * factor, y: -crop.minY * factor,
                                  width: image.size.width * factor, height: image.size.height * factor))
        }
    }
}

private extension View {
    /// Masks out the given shape — the inverse of .mask.
    func reverseMask(@ViewBuilder _ shape: () -> some View) -> some View {
        mask {
            Rectangle().overlay { shape().blendMode(.destinationOut) }.compositingGroup()
        }
    }
}
