package com.phaserugbymanager.app;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

/**
 * THE ACTIVITY: THE BACK BUTTON THAT NEVER CLOSES THE GAME, AND A SCREEN THAT
 * STAYS ON WHILE IT IS OPEN (see onCreate).
 *
 * Owner, 1.8.10, on a Samsung: "Every time I hit back button on my Samsung it
 * still makes me quit the game. It should ALWAYS take me to title page to keep
 * me in the game. Never quit unless I press the middle menu button."
 *
 * Capacitor 8's BridgeActivity does not handle Back at all (that moved to the
 * optional @capacitor/app plugin, which this app does not ship), so Android's
 * default ran: finish the activity. The game's own Back handling lives in the
 * web page (src/ui/App.tsx, a popstate listener over one spare history entry)
 * and was never reached. This callback is always enabled, so Android never
 * finishes the activity on Back, gesture or button, predictive back included.
 * It hands the press to the page as history.back(): inside a career that pops
 * the spare and the game steps back (menu, page, Home, then the title); on the
 * title there is nothing to pop and nothing happens. The game is left only with
 * the system Home or Recents button.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // the purchase bridge is part of the app, not an npm package, so it is
        // registered here by hand - before super.onCreate, or the bridge has
        // already built its plugin list without it
        registerPlugin(PhaseBilling.class);
        super.onCreate(savedInstanceState);

        // THE SCREEN STAYS ON WHILE THE GAME IS OPEN (owner, 1.8.11: "the
        // screen saver energy mode is coming on when in-game ... Like in
        // fmmobile it just stays on screen"). A window flag, so it holds only
        // while this activity is in front: leave the game and the phone sleeps
        // on its own timer as usual. No permission needed.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = bridge != null ? bridge.getWebView() : null;
                if (web != null) web.evaluateJavascript("window.history.back()", null);
            }
        });
    }
}
