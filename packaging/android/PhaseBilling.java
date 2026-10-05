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
//  AND EVERY PURCHASE IS ACKNOWLEDGED, CONSUMABLE OR NOT. Play refunds any
//  purchase not acknowledged within three days - the 29 Aug 2026 refund email,
//  and again on 12 Sep - and the rule above means a consumable can sit
//  unconsumed for a week without anybody doing anything wrong. Acknowledging
//  is not delivering and it is not consuming: the receipt stays owned, owned()
//  keeps offering it back, and consume() still happens on the game's terms.
//  All it does is stop the refund clock, which is the one thing the deferred
//  design forgot to do. This is why settle() no longer has a consumable branch
//  and why nothing here needs to know which products are repeatable.
//
package com.phaserugbymanager.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
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
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

@CapacitorPlugin(name = "PhaseBilling")
public class PhaseBilling extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "PhaseBilling";

    private BillingClient client;

    /** The buy() call waiting on Play's sheet. Play answers through
     *  onPurchasesUpdated, not through the launch call, so the call is parked
     *  here until it does. One at a time: the game's till runs one purchase
     *  per SKU and disables the shelf while it waits. */
    private final AtomicReference<PluginCall> pendingBuy = new AtomicReference<>(null);
    private volatile String pendingSku = null;

    /** HOW LONG A PARKED buy() MAY WAIT (1.8.3). onPurchasesUpdated is the only
     *  thing that released the call, and if it never came (the activity torn
     *  down under the sheet, Play's service dying mid-flow) pendingBuy stayed
     *  set for the life of the process: every later tap answered 'pending'
     *  and nothing could be bought until the app was killed. The game stops
     *  waiting at ninety seconds and calls the purchase pending
     *  (src/game/storekit.ts); this lets go a little after, so the game's
     *  answer always comes first and the next tap is a real one. Play's sheet
     *  covers the game while it is open, so a tap that finds a call parked
     *  this long is never a second sheet over a first. The stuck call is
     *  answered 'pending', never 'error': money may have moved, and a
     *  purchase that lands afterwards (a bank's check that ran long) is still
     *  settled by onPurchasesUpdated and handed over by owned(), as Restore
     *  does. */
    private static final long BUY_TIMEOUT_MS = 120 * 1000L;
    private final Handler timer = new Handler(Looper.getMainLooper());
    /** When the parked call was parked (elapsedRealtime), so a tap can see a
     *  stuck call for itself even if the timer never ran. */
    private volatile long pendingSince = 0L;

    /** The response code of the last failed connection, so a buy() that
     *  could not connect can say WHY: BILLING_UNAVAILABLE (Play will not
     *  bill this account - an unsupported country, an old Play Store, a
     *  managed account) is a different sentence from a service that did not
     *  answer. */
    private volatile int setupCode = BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE;

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

    /** The activity is going: let go of Play's service, or the next
     *  activity's plugin builds a second client beside a leaked first. */
    @Override
    protected void handleOnDestroy() {
        if (client != null) client.endConnection();
        super.handleOnDestroy();
    }

    // ---- connection ----

    private interface Ready { void run(boolean ok); }

    /** Everybody waiting on the one startConnection in flight. Billing 8
     *  answers a second startConnection made while the first is still
     *  connecting with DEVELOPER_ERROR ("Client is already in the process of
     *  connecting to billing service."), which buy() would report as
     *  'refused'/'config'. Concurrent callers queue here instead. */
    private final List<Ready> waiting = new ArrayList<>();
    private boolean connecting = false; // guarded by `waiting`

    /** Connect if not connected, then run. The library drops the connection
     *  when Play's service restarts, so every entry point goes through here. */
    private void connect(final Ready then) {
        if (client == null) { if (then != null) then.run(false); return; }
        if (client.isReady()) { if (then != null) then.run(true); return; }
        synchronized (waiting) {
            if (then != null) waiting.add(then);
            if (connecting) return;
            connecting = true;
        }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) {
                boolean ok = r.getResponseCode() == BillingClient.BillingResponseCode.OK;
                if (!ok) { setupCode = r.getResponseCode(); Log.w(TAG, "billing setup: " + r.getDebugMessage()); }
                List<Ready> run;
                synchronized (waiting) { connecting = false; run = new ArrayList<>(waiting); waiting.clear(); }
                for (Ready w : run) w.run(ok);
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
                        // 1.8.6: the same price as a number, for the one-time
                        // offer's check that a printed percentage is true.
                        // Never shown; the formatted price above is.
                        if (one != null) o.put("micros", one.getPriceAmountMicros());
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
        PluginCall parked;
        long since;
        synchronized (pendingBuy) { parked = pendingBuy.get(); since = pendingSince; }
        if (parked != null && SystemClock.elapsedRealtime() - since >= BUY_TIMEOUT_MS) {
            // parked past its time and the timer has not let it go: let it go
            // now, and this tap goes ahead as a fresh purchase
            releaseStuck(parked);
            parked = pendingBuy.get();
        }
        if (parked != null) {
            // a second tap while a sheet is still open. This used to answer
            // 'refused', which the game read out as a refusal of the PRODUCT
            // ("not on sale in your country"). It is a purchase already in
            // flight, so it says so: 'pending', and Restore picks up the
            // first one if it lands.
            call.resolve(outcome("pending")); return;
        }
        connect(ok -> {
            if (!ok) { call.resolve(outcome(mapCode(setupCode), causeOf(setupCode))); return; }
            queryDetails(Arrays.asList(sku), (r, list) -> {
                if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.resolve(outcome(mapCode(r.getResponseCode()), causeOf(r.getResponseCode()))); return;
                }
                if (list == null || list.isEmpty()) {
                    // Play answered and does not list this id here: it is not
                    // active in the Play Console, or not available in this
                    // account's country. 'unavailable', and it is ours to fix
                    call.resolve(outcome("unavailable", "notOffered")); return;
                }
                Activity activity = getActivity();
                if (activity == null) { call.resolve(outcome("error")); return; }
                List<BillingFlowParams.ProductDetailsParams> params = new ArrayList<>();
                params.add(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(list.get(0)).build());
                // two taps can both pass the check above before either parks:
                // only the first parks, the second is told one is in flight
                // call, sku and stamp change together, or a finishBuy() for the
                // last purchase can null the sku of this one
                synchronized (pendingBuy) {
                    if (!pendingBuy.compareAndSet(null, call)) { call.resolve(outcome("pending")); return; }
                    pendingSku = sku;
                    pendingSince = SystemClock.elapsedRealtime();
                }
                // a Capacitor call that waits on a later callback must be
                // kept, or the bridge releases it and the answer has nowhere
                // to go
                call.setKeepAlive(true);
                // and it is not kept for ever (BUY_TIMEOUT_MS)
                // (the call is the token, so finishBuy removes THIS timer only)
                timer.postAtTime(() -> releaseStuck(call), call, SystemClock.uptimeMillis() + BUY_TIMEOUT_MS);
                // launchBillingFlow is @UiThread in Billing 8, and this
                // callback runs on Capacitor's plugin thread
                timer.post(() -> {
                    BillingResult launch = client.launchBillingFlow(activity,
                        BillingFlowParams.newBuilder().setProductDetailsParamsList(params).build());
                    if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        // the sheet did not open: answer now, do not wait for a
                        // callback that will never come
                        finishBuy(mapCode(launch.getResponseCode()), causeOf(launch.getResponseCode()));
                    }
                });
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
            boolean other = false;
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    settle(p);
                    for (String s : p.getProducts()) { if (s.equals(pendingSku)) settled = "owned"; else other = true; }
                } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    // cash at a shop, a slow card: a customer who has begun to
                    // pay must not be told that they have failed
                    for (String s : p.getProducts()) { if (s.equals(pendingSku)) settled = "pending"; else other = true; }
                }
            }
            if (settled != null) finishBuy(settled);
            // a purchase for some other product, landing late: one whose call
            // was let go as stuck (BUY_TIMEOUT_MS), or one cleared outside the
            // sheet. It is settled above and owned() hands it over; it says
            // nothing about the sheet that is open now, so that call waits on
            else if (other) return;
            else if (pendingBuy.get() != null) finishBuy("error");
            return;
        }
        if (pendingBuy.get() != null) finishBuy(mapCode(code), causeOf(code));
    }

    /**
     * ACKNOWLEDGE EVERY PURCHASE, CONSUMABLE OR NOT.
     *
     * This used to return early for consumables, on the documented reasoning
     * that consumeAsync() acknowledges implicitly - which is true, but only
     * once consume actually runs. The game defers that until the career has
     * kept what was bought, and a customer who buys a tip and does not come
     * back to the Store never triggers it at all. Play refunds any purchase
     * not acknowledged inside three days, so every deferred consumable was
     * being quietly refunded: the 29 Aug 2026 email, and again on 12 Sep.
     *
     * Acknowledging first costs nothing. It does NOT deliver the purchase and
     * it does NOT consume it - the receipt stays owned, owned() keeps offering
     * it back, and consume() still happens later on the game's own terms. All
     * it does is stop the refund clock, which is the one thing the deferred
     * design forgot to do.
     */
    private void settle(Purchase p) {
        if (!p.isAcknowledged()) {
            client.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
                res -> { if (res.getResponseCode() != BillingClient.BillingResponseCode.OK) Log.w(TAG, "acknowledge: " + res.getDebugMessage()); });
        }
    }

    private void finishBuy(String result) { finishBuy(result, null); }

    private void finishBuy(String result, String cause) {
        PluginCall call;
        synchronized (pendingBuy) {
            call = pendingBuy.getAndSet(null);
            if (call == null) return;
            pendingSku = null;
        }
        // answered in time: its timer has nothing left to do
        timer.removeCallbacksAndMessages(call);
        call.resolve(outcome(result, cause));
        call.release(getBridge());
    }

    /** Let go of a parked buy() that Play never answered (BUY_TIMEOUT_MS), as
     *  'pending'. Only THAT call: if it was answered meanwhile, or another
     *  purchase has parked since, this does nothing. */
    private void releaseStuck(PluginCall call) {
        synchronized (pendingBuy) {
            if (!pendingBuy.compareAndSet(call, null)) return;
            pendingSku = null;
        }
        Log.w(TAG, "buy: no answer from Play in " + (BUY_TIMEOUT_MS / 1000) + "s; released as pending");
        call.resolve(outcome("pending"));
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

    /** Which kind of "no" a response code is (1.8.3), sent beside the
     *  outcome word so the game can tell the player the true one. The names
     *  are BillingCause in src/game/monetise.ts; anything else is sent as
     *  nothing and the game falls back to the sentence true of every cause. */
    private static String causeOf(int code) {
        switch (code) {
            case BillingClient.BillingResponseCode.ITEM_UNAVAILABLE: return "notOffered";
            // Play's own documentation for this code: the Play Store app is
            // out of date, the user is in an unsupported country, the account
            // is managed with purchases off, or the payment method failed
            case BillingClient.BillingResponseCode.BILLING_UNAVAILABLE: return "playBilling";
            case BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED: return "disabled";
            case BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE:
            case BillingClient.BillingResponseCode.SERVICE_DISCONNECTED:
            case BillingClient.BillingResponseCode.NETWORK_ERROR: return "unreachable";
            case BillingClient.BillingResponseCode.DEVELOPER_ERROR: return "config";
            default: return null;
        }
    }

    private static JSObject outcome(String s) { return outcome(s, null); }

    private static JSObject outcome(String s, String cause) {
        JSObject o = new JSObject();
        o.put("outcome", s);
        if (cause != null) o.put("cause", cause);
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

    /**
     * The career kept what was bought, so the receipt can be spent. Consuming
     * is what lets Play sell the same consumable again - and until it happens,
     * owned() keeps offering the purchase back.
     *
     * IT NOW SAYS WHETHER IT WORKED. This used to call resolve() with nothing
     * whatever Play answered, so the only thing the game could do was consume,
     * re-read owned(), and infer a spend from the receipt having gone. That
     * inference is wrong in the one case that costs money: a consume that
     * takes longer than the JS watchdog returns "nothing happened" to a caller
     * that then banks nothing - and the consume lands a moment later, taking
     * the receipt with it. Paid, and nothing received.
     *
     * `ok` is the only field a caller needs. `code` is the Billing response
     * for a log or a probe: ITEM_NOT_OWNED reads very differently from
     * SERVICE_UNAVAILABLE when somebody is working out why a spend did not
     * land, and hiding it behind a bare resolve() cost us that.
     */
    @PluginMethod
    public void consume(final PluginCall call) {
        final String sku = call.getString("sku");
        if (sku == null) { done(call, false, BillingClient.BillingResponseCode.DEVELOPER_ERROR); return; }
        connect(ok -> {
            if (!ok) { done(call, false, BillingClient.BillingResponseCode.SERVICE_DISCONNECTED); return; }
            client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (r, purchases) -> {
                    if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) { done(call, false, r.getResponseCode()); return; }
                    Purchase found = null;
                    for (Purchase p : purchases) {
                        if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED && p.getProducts().contains(sku)) { found = p; break; }
                    }
                    // nothing to spend is not a failure of this call - it is the
                    // answer. The caller must not bank a credit for it.
                    if (found == null) { done(call, false, BillingClient.BillingResponseCode.ITEM_NOT_OWNED); return; }
                    client.consumeAsync(
                        ConsumeParams.newBuilder().setPurchaseToken(found.getPurchaseToken()).build(),
                        (res, token) -> {
                            int code = res.getResponseCode();
                            if (code != BillingClient.BillingResponseCode.OK) Log.w(TAG, "consume: " + res.getDebugMessage());
                            done(call, code == BillingClient.BillingResponseCode.OK, code);
                        });
                });
        });
    }

    /** One shape for every exit from consume(), so a caller never has to guess
     *  whether an empty resolve meant success. */
    private void done(PluginCall call, boolean ok, int code) {
        JSObject out = new JSObject();
        out.put("ok", ok);
        out.put("code", code);
        call.resolve(out);
    }
}
