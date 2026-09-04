//
//  PhaseBilling.java
//  PHASE: Rugby Manager
//
//  The Google half of the purchase bridge, on the Play Billing Library. It
//  answers to the SAME four-method contract as PhaseBilling.swift on iOS -
//  details, buy, owned, consume, with the same result shapes and the same
//  five outcome words - so src/game/storekit.ts attaches to it without knowing
//  which phone it is on. scaffold.sh copies this file into the generated
//  project and registers it in MainActivity.
//
//  WHY THIS EXISTS AT ALL. The Play Store build used to be a Trusted Web
//  Activity: Chrome, showing phaserugbymanager.com, and purchases went through
//  Chrome's Digital Goods API (src/game/playbilling.ts). A Capacitor WebView
//  has no Digital Goods API, so the shell needs its own road to Play Billing,
//  and this is it. playbilling.ts stays for anybody still on the TWA and for
//  the website; on this shell its attach step finds no getDigitalGoodsService
//  and stands aside, and storekit.ts finds this plugin instead.
//
//  THE ONE DESIGN DECISION WORTH READING, the same as on iOS: CONSUMABLES ARE
//  LEFT UNCONSUMED AT PURCHASE. A consumable (the board injections, Full
//  Fitness, the tip jar, the second Estate) is bought here and deliberately
//  NOT consumed. consume(sku) is called by the game only after the career has
//  kept what was bought. An unconsumed purchase survives a crash, a flat
//  battery and a reinstall: queryPurchasesAsync hands it back on the next
//  launch, owned() reports it, and the game's "paid, and held" rows offer it
//  to the career again. Consume at purchase and a customer interrupted between
//  paying and receiving has simply lost the money.
//
//  Non-consumables are ACKNOWLEDGED immediately. Play refunds any purchase not
//  acknowledged within three days (the 29 Aug 2026 refund email), so a
//  permanent entitlement is acknowledged the moment it is granted and again,
//  belt and braces, whenever owned() finds one that somehow was not.
//
package com.phaserugbymanager.app;

import android.app.Activity;
import android.util.Log;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

@CapacitorPlugin(name = "PhaseBilling")
public class PhaseBilling extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "PhaseBilling";

    /** The repeatable products. Everything else is owned for ever. Must match
     *  CONSUMABLE_SKUS in src/game/monetise.ts and the Swift twin. */
    private static final Set<String> CONSUMABLES = new HashSet<>(Arrays.asList(
        "phase.inject.s", "phase.inject.m", "phase.inject.l", "phase.inject.xl",
        "phase.heal",
        "phase.license",
        "phase.ground"
    ));

    private BillingClient client;

    /** The buy() call waiting on Play's sheet. Play answers through
     *  onPurchasesUpdated, not through the launch call, so the call is parked
     *  here until it does. One at a time: the game's till runs one purchase
     *  per SKU and disables the shelf while it waits. */
    private final AtomicReference<PluginCall> pendingBuy = new AtomicReference<>(null);
    private String pendingSku = null;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            // pending purchases (cash at a shop, a slow card) must be enabled
            // or the library refuses to connect; the game reports them as
            // 'pending', which is what they are
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
        connect(null);
    }

    // ---- connection ----

    private interface Ready { void run(boolean ok); }

    /** Connect if not connected, then run. The library drops the connection
     *  when Play's service restarts, so every entry point goes through here. */
    private void connect(final Ready then) {
        if (client == null) { if (then != null) then.run(false); return; }
        if (client.isReady()) { if (then != null) then.run(true); return; }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) {
                boolean ok = r.getResponseCode() == BillingClient.BillingResponseCode.OK;
                if (!ok) Log.w(TAG, "billing setup: " + r.getDebugMessage());
                if (then != null) then.run(ok);
            }
            @Override public void onBillingServiceDisconnected() {
                Log.w(TAG, "billing service disconnected; will reconnect on the next call");
            }
        });
    }

    // ---- details ----

    /** What Play says these cost, in the customer's own storefront. The
     *  formatted price is passed through untouched: a price assembled here
     *  would be wrong in most of the world. */
    @PluginMethod
    public void details(final PluginCall call) {
        JSArray arr = call.getArray("skus");
        final List<String> skus = new ArrayList<>();
        if (arr != null) {
            try { for (int i = 0; i < arr.length(); i++) skus.add(arr.getString(i)); }
            catch (Exception e) { /* a malformed list is an empty list */ }
        }
        if (skus.isEmpty()) { call.resolve(withProducts(new ArrayList<>())); return; }
        connect(ok -> {
            if (!ok) { call.resolve(withProducts(new ArrayList<>())); return; }
            queryDetails(skus, (r, list) -> {
                List<JSObject> out = new ArrayList<>();
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && list != null) {
                    for (ProductDetails d : list) {
                        ProductDetails.OneTimePurchaseOfferDetails one = d.getOneTimePurchaseOfferDetails();
                        JSObject o = new JSObject();
                        o.put("sku", d.getProductId());
                        o.put("price", one != null ? one.getFormattedPrice() : "");
                        o.put("title", d.getName());
                        out.add(o);
                    }
                } else {
                    Log.w(TAG, "queryProductDetails: " + r.getDebugMessage());
                }
                call.resolve(withProducts(out));
            });
        });
    }

    private interface DetailsBack { void run(BillingResult r, List<ProductDetails> list); }

    private void queryDetails(List<String> skus, DetailsBack back) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String s : skus) {
            products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(s)
                .setProductType(BillingClient.ProductType.INAPP)
                .build());
        }
        // Billing Library 8 wraps the list in a QueryProductDetailsResult (7.x
        // handed it over bare). Play refuses uploads below 8.0.0 since the
        // 4 Sep 2026 attempt, so version.json pins 8; this is the one line that
        // knows.
        client.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(products).build(),
            (r, result) -> back.run(r, result == null ? null : result.getProductDetailsList()));
    }

    private static JSObject withProducts(List<JSObject> list) {
        JSObject o = new JSObject();
        o.put("products", new JSArray(list));
        return o;
    }

    // ---- buy ----

    /** Open Play's own purchase sheet. Every ending maps to one of the five
     *  words monetise.ts understands, and only 'owned' grants anything. */
    @PluginMethod
    public void buy(final PluginCall call) {
        final String sku = call.getString("sku");
        if (sku == null) { call.resolve(outcome("error")); return; }
        if (pendingBuy.get() != null) {
            // a second tap while the sheet is up: the till already refuses
            // this, so it is only reachable by a race, and 'refused' is honest
            call.resolve(outcome("refused")); return;
        }
        connect(ok -> {
            if (!ok) { call.resolve(outcome("unavailable")); return; }
            queryDetails(Arrays.asList(sku), (r, list) -> {
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK || list == null || list.isEmpty()) {
                    // the id is not in the Play Console, or is not active yet:
                    // 'unavailable' is the honest word
                    call.resolve(outcome("unavailable")); return;
                }
                Activity activity = getActivity();
                if (activity == null) { call.resolve(outcome("error")); return; }
                List<BillingFlowParams.ProductDetailsParams> params = new ArrayList<>();
                params.add(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(list.get(0)).build());
                pendingSku = sku;
                pendingBuy.set(call);
                // a Capacitor call that waits on a later callback must be
                // kept, or the bridge releases it and the answer has nowhere
                // to go
                call.setKeepAlive(true);
                BillingResult launch = client.launchBillingFlow(activity,
                    BillingFlowParams.newBuilder().setProductDetailsParamsList(params).build());
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    // the sheet did not open: answer now, do not wait for a
                    // callback that will never come
                    finishBuy(mapCode(launch.getResponseCode()));
                }
            });
        });
    }

    /** Play's answer to the sheet, and also where a purchase approved outside
     *  the sheet (a pending one that cleared) arrives. */
    @Override
    public void onPurchasesUpdated(@NonNull BillingResult r, List<Purchase> purchases) {
        int code = r.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            String settled = null;
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    settle(p);
                    for (String s : p.getProducts()) if (s.equals(pendingSku)) settled = "owned";
                } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    // cash at a shop, a slow card: a customer who has begun to
                    // pay must not be told that they have failed
                    for (String s : p.getProducts()) if (s.equals(pendingSku)) settled = "pending";
                }
            }
            if (settled != null) finishBuy(settled);
            else if (pendingBuy.get() != null) finishBuy("error");
            return;
        }
        if (pendingBuy.get() != null) finishBuy(mapCode(code));
    }

    /** Acknowledge a permanent purchase; leave a consumable for consume(). */
    private void settle(Purchase p) {
        boolean consumable = false;
        for (String s : p.getProducts()) if (CONSUMABLES.contains(s)) consumable = true;
        if (consumable) return;
        if (!p.isAcknowledged()) {
            client.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
                res -> { if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) Log.w(TAG, "acknowledge: " + res.getDebugMessage()); });
        }
    }

    private void finishBuy(String result) {
        PluginCall call = pendingBuy.getAndSet(null);
        pendingSku = null;
        if (call == null) return;
        call.resolve(outcome(result));
        call.release(getBridge());
    }

    /** Play's response codes, as the five words. USER_CANCELED is NOT an
     *  error; ITEM_ALREADY_OWNED is an undelivered purchase, which owned()
     *  will report and the game will hand over - so it is 'owned' here too. */
    private static String mapCode(int code) {
        switch (code) {
            case BillingClient.BillingResponseCode.USER_CANCELED: return "cancelled";
            case BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED: return "owned";
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE:
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE:
            case BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED:
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE:
            case BillingClient.BillingResponseCode.SERVICE_DISCONNECTED:
            case BillingClient.BillingResponseCode.NETWORK_ERROR: return "unavailable";
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR: return "refused";
            default: return "error";
        }
    }

    private static JSObject outcome(String s) {
        JSObject o = new JSObject();
        o.put("outcome", s);
        return o;
    }

    // ---- owned ----

    /** Everything this Google account owns that the game should honour: the
     *  permanent entitlements, plus any consumable paid for and not yet
     *  consumed. The second half is what makes an interrupted purchase
     *  recoverable rather than lost. A permanent purchase found
     *  unacknowledged is acknowledged on the spot. */
    @PluginMethod
    public void owned(final PluginCall call) {
        connect(ok -> {
            if (!ok) { call.resolve(withSkus(new ArrayList<>())); return; }
            client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (r, purchases) -> {
                    List<String> skus = new ArrayList<>();
                    if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        for (Purchase p : purchases) {
                            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                            settle(p);
                            skus.addAll(p.getProducts());
                        }
                    } else {
                        Log.w(TAG, "queryPurchases: " + r.getDebugMessage());
                    }
                    call.resolve(withSkus(skus));
                });
        });
    }

    private static JSObject withSkus(List<String> skus) {
        JSObject o = new JSObject();
        o.put("skus", new JSArray(skus));
        return o;
    }

    // ---- consume ----

    /** The career kept what was bought, so the receipt can be spent.
     *  Consuming is what lets Play sell the same consumable again - and until
     *  it happens, owned() keeps offering the purchase back. */
    @PluginMethod
    public void consume(final PluginCall call) {
        final String sku = call.getString("sku");
        if (sku == null) { call.resolve(); return; }
        connect(ok -> {
            if (!ok) { call.resolve(); return; }
            client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (r, purchases) -> {
                    if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.resolve(); return; }
                    Purchase found = null;
                    for (Purchase p : purchases) {
                        if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED && p.getProducts().contains(sku)) { found = p; break; }
                    }
                    if (found == null) { call.resolve(); return; }
                    client.consumeAsync(
                        ConsumeParams.newBuilder().setPurchaseToken(found.getPurchaseToken()).build(),
                        (res, token) -> {
                            if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) Log.w(TAG, "consume: " + res.getDebugMessage());
                            call.resolve();
                        });
                });
        });
    }
}
