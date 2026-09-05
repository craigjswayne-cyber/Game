//
//  PhaseBilling.swift
//  PHASE: Rugby Manager
//
//  The Apple half of the purchase bridge. Drop this and PhaseBilling.m into
//  the generated App target (see README.md §5); nothing else in the Xcode
//  project needs editing.
//
//  WHAT IT IS. src/game/monetise.ts defines a four-method contract - details,
//  buy, owned, consume - and knows nothing about any store. src/game/storekit.ts
//  dresses this class in that contract. So the game asks for a purchase, this
//  asks StoreKit, and nothing in between knows which platform it is on.
//
//  THE ONE DESIGN DECISION WORTH READING: CONSUMABLES ARE LEFT UNFINISHED.
//
//  A consumable (the four board injections, Full Fitness and the tip jar) is bought here
//  and its transaction is deliberately NOT finished at purchase. It is
//  finished by consume(sku), which the game calls only after the career has
//  actually kept what was bought.
//
//  That is not a flourish, it is the recovery path. An unfinished transaction
//  survives a crash, a force-quit, a flat battery and a reinstall: StoreKit
//  hands it back through Transaction.unfinished on the next launch, owned()
//  reports it, and the game's existing "paid, and held" rows offer it to the
//  career again. Finish it at purchase and a customer who was interrupted
//  between paying and receiving has simply lost the money - which is the one
//  outcome monetise.ts exists to prevent.
//
//  Non-consumables are finished immediately: the entitlement itself is the
//  permanent record, and Transaction.currentEntitlements is where it lives.
//
import Foundation
import Capacitor
import StoreKit

@objc(PhaseBilling)
public class PhaseBilling: CAPPlugin {

    /// The repeatable products. Everything else in the catalogue is owned for
    /// ever. This list is the ONLY place the two kinds are told apart on this
    /// side, and it must match CONSUMABLE_SKUS in src/game/monetise.ts.
    private static let consumables: Set<String> = [
        "phase.inject.s", "phase.inject.m", "phase.inject.l", "phase.inject.xl",
        "phase.heal",
        // v1.1.12: "Support the game" is a tip jar, and a tip jar takes more
        // than one coin. It grants nothing, so finishing it costs nothing.
        "phase.license",
        // v1.1.14: the Estate is one build per CLUB now, and phase.estate is a
        // non-consumable the store will only ever sell once. The first ground is
        // covered by that purchase; every ground after it is one of these.
        "phase.ground",
    ]

    /// Ask-to-Buy, a purchase approved on another device, a subscription
    /// renewal we do not have: StoreKit delivers all of them here rather than
    /// through purchase(). Non-consumables are finished as they arrive;
    /// consumables are left for consume() exactly like a fresh purchase, so a
    /// parent's approval that lands on Tuesday is still offered to the career.
    private var updates: Task<Void, Never>?

    override public func load() {
        updates = Task.detached { [weak self] in
            for await update in Transaction.updates {
                // `self != nil` rather than `let self`: the check is here to stop
                // finishing transactions once the plugin is gone, and nothing in
                // the body needs the instance (consumables is static). Binding it
                // is an unused-value warning in Xcode, and a warning nobody can
                // act on is a warning everybody learns to ignore.
                guard self != nil, case .verified(let t) = update else { continue }
                if !Self.consumables.contains(t.productID) {
                    await t.finish()
                }
                // the page re-reads entitlements at boot and on Restore; there
                // is nothing to push, and pushing would race the web view's
                // own lifecycle
            }
        }
    }

    deinit { updates?.cancel() }

    // MARK: - details

    /// What the store says these cost, in the customer's own storefront.
    /// displayPrice is passed through untouched: StoreKit has already
    /// formatted it for the locale and currency, and a price assembled here
    /// would be wrong in most of the world.
    @objc func details(_ call: CAPPluginCall) {
        let skus = call.getArray("skus", String.self) ?? []
        Task {
            do {
                let products = try await Product.products(for: skus)
                call.resolve(["products": products.map {
                    ["sku": $0.id, "price": $0.displayPrice, "title": $0.displayName]
                }])
            } catch {
                // a configuration mistake or no network: no price, never a
                // crash and never a guess
                call.resolve(["products": []])
            }
        }
    }

    // MARK: - buy

    /// Open Apple's own purchase sheet. Every ending maps to one of the five
    /// words monetise.ts understands, and only one of them grants anything.
    @objc func buy(_ call: CAPPluginCall) {
        guard let sku = call.getString("sku") else {
            call.resolve(["outcome": "error"]); return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [sku]).first else {
                    // the id is not in App Store Connect, or is not approved
                    // yet: "unavailable" is the honest word and the game says
                    // so plainly rather than blaming the customer
                    call.resolve(["outcome": "unavailable"]); return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        // StoreKit could not verify its own signature: treat
                        // it as a failure, never as a sale
                        call.resolve(["outcome": "error"]); return
                    }
                    if !Self.consumables.contains(sku) {
                        await transaction.finish()
                    }
                    // a consumable stays unfinished until consume(sku) - see
                    // the note at the top of this file
                    call.resolve(["outcome": "owned"])
                case .userCancelled:
                    // NOT an error. Telling somebody who changed their mind
                    // that something went wrong is how a purchase flow earns
                    // a one-star review.
                    call.resolve(["outcome": "cancelled"])
                case .pending:
                    // Ask-to-Buy: a parent has to approve, which can take
                    // days. Reporting this as a failure tells somebody who
                    // has paid that they have not.
                    call.resolve(["outcome": "pending"])
                @unknown default:
                    call.resolve(["outcome": "error"])
                }
            } catch {
                call.resolve(["outcome": "error"])
            }
        }
    }

    // MARK: - owned

    /// Everything this Apple ID owns that the game should honour: the
    /// permanent entitlements, plus any consumable that is paid for and not
    /// yet spent. The second half is what makes an interrupted purchase
    /// recoverable rather than lost.
    @objc func owned(_ call: CAPPluginCall) {
        Task {
            var skus = Set<String>()
            for await entitlement in Transaction.currentEntitlements {
                if case .verified(let t) = entitlement { skus.insert(t.productID) }
            }
            for await unfinished in Transaction.unfinished {
                if case .verified(let t) = unfinished, Self.consumables.contains(t.productID) {
                    skus.insert(t.productID)
                }
            }
            call.resolve(["skus": Array(skus)])
        }
    }

    // MARK: - consume

    /// The career kept what was bought, so the receipt can be spent. Finishing
    /// is what lets the App Store sell the same consumable again - and until
    /// it happens, owned() keeps offering the purchase back.
    @objc func consume(_ call: CAPPluginCall) {
        guard let sku = call.getString("sku") else { call.resolve(); return }
        Task {
            for await unfinished in Transaction.unfinished {
                if case .verified(let t) = unfinished, t.productID == sku {
                    await t.finish()
                }
            }
            call.resolve()
        }
    }
}
