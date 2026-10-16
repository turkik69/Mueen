package com.turkik69.mueen;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceActionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
