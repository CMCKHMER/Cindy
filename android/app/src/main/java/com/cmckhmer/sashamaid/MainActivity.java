package com.cmckhmer.sashamaid;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(FileAccessPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
