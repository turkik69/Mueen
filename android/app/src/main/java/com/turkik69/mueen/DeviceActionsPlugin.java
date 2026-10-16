package com.turkik69.mueen;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.AlarmClock;
import android.provider.ContactsContract;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@CapacitorPlugin(name = "DeviceActions", permissions = {
    @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS }),
    @Permission(alias = "phone", strings = { Manifest.permission.CALL_PHONE })
})
public class DeviceActionsPlugin extends Plugin {
    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        if (hour == null || hour < 0 || hour > 23 || minute == null || minute < 0 || minute > 59) {
            call.reject("Invalid clock time", "INVALID_TIME");
            return;
        }
        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_MESSAGE, "منبّه مُعين")
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true);
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("Clock app unavailable", "CLOCK_UNAVAILABLE", error);
        }
    }

    @PluginMethod
    public void callContact(PluginCall call) {
        String name = call.getString("name", "").trim();
        if (name.isEmpty() || name.length() > 100) {
            call.reject("Contact name required", "INVALID_CONTACT");
            return;
        }
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "contactsPermission");
            return;
        }
        findAndCall(call);
    }

    @PermissionCallback
    private void contactsPermission(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            call.reject("Contacts access denied", "CONTACTS_DENIED");
            return;
        }
        findAndCall(call);
    }

    private void findAndCall(PluginCall call) {
        String name = normalize(call.getString("name", ""));
        Map<String, String> numbers = new LinkedHashMap<>();
        String[] columns = { ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER };
        try (Cursor rows = getContext().getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI, columns, null, null, null)) {
            if (rows == null) {
                call.reject("Contacts unavailable", "CONTACTS_UNAVAILABLE");
                return;
            }
            while (rows.moveToNext()) {
                if (!normalize(rows.getString(0)).equals(name)) continue;
                String number = rows.getString(1);
                if (number != null && !number.trim().isEmpty()) {
                    String key = number.replaceAll("[^0-9+]", "");
                    numbers.put(key, number);
                }
            }
        } catch (SecurityException error) {
            call.reject("Contacts access denied", "CONTACTS_DENIED", error);
            return;
        }
        if (numbers.isEmpty()) {
            call.reject("Contact not found", "CONTACT_NOT_FOUND");
            return;
        }
        if (numbers.size() > 1) {
            call.reject("Multiple phone numbers match this name", "AMBIGUOUS_CONTACT");
            return;
        }
        if (getPermissionState("phone") != PermissionState.GRANTED) {
            requestPermissionForAlias("phone", call, "phonePermission");
            return;
        }
        startCall(call, numbers.values().iterator().next());
    }

    @PermissionCallback
    private void phonePermission(PluginCall call) {
        if (getPermissionState("phone") != PermissionState.GRANTED) {
            call.reject("Phone access denied", "PHONE_DENIED");
            return;
        }
        // Look up again after the permission prompt; the contact could have changed.
        findAndCall(call);
    }

    private void startCall(PluginCall call, String number) {
        if (getContext().checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Phone access denied", "PHONE_DENIED");
            return;
        }
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_CALL, Uri.fromParts("tel", number, null)));
            JSObject result = new JSObject();
            result.put("started", true);
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("Phone app unavailable", "PHONE_UNAVAILABLE", error);
        }
    }

    private static String normalize(String text) {
        if (text == null) return "";
        return text.replaceAll("[\\u064B-\\u065F\\u0640]", "")
            .replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
            .replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
    }
}
