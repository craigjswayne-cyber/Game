//
//  PhaseBilling.m
//
//  Capacitor finds plugins through the Objective-C runtime, so a Swift plugin
//  still needs this stub to declare itself and its methods. Every method named
//  here must exist in PhaseBilling.swift with a matching selector, and any
//  method NOT named here is invisible to the web view - which is the quiet way
//  a bridge ends up missing a method it appears to have.
//
#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(PhaseBilling, "PhaseBilling",
           CAP_PLUGIN_METHOD(details, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(buy, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(owned, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(consume, CAPPluginReturnPromise);
)
