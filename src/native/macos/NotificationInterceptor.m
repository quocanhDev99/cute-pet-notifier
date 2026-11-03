#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>

// MARK: - JSON Output Helper
static void emitJSON(NSDictionary *dict) {
    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:&error];
    if (data && !error) {
        NSString *str = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (str) {
            printf("%s\n", [str UTF8String]);
            fflush(stdout);
        }
    }
}

// MARK: - Accessibility Attribute Helpers
static id getAXAttribute(AXUIElementRef element, CFStringRef attribute) {
    CFTypeRef value = NULL;
    AXError result = AXUIElementCopyAttributeValue(element, attribute, &value);
    if (result == kAXErrorSuccess && value != NULL) {
        return (__bridge_transfer id)value;
    }
    return nil;
}

static NSArray *getAXChildren(AXUIElementRef element) {
    id children = getAXAttribute(element, kAXChildrenAttribute);
    if ([children isKindOfClass:[NSArray class]]) {
        return (NSArray *)children;
    }
    return @[];
}

static void collectTextsRecursive(AXUIElementRef element, NSMutableArray<NSString *> *results, int depth) {
    if (depth > 8) return;
    
    NSString *role = getAXAttribute(element, kAXRoleAttribute);
    NSString *value = getAXAttribute(element, kAXValueAttribute);
    NSString *title = getAXAttribute(element, kAXTitleAttribute);
    NSString *desc = getAXAttribute(element, kAXDescriptionAttribute);
    
    if ([role isEqualToString:(__bridge NSString *)kAXStaticTextRole]) {
        if (value && [value stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]].length > 0) {
            [results addObject:value];
        } else if (title && [title stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]].length > 0) {
            [results addObject:title];
        }
    }
    
    if (desc && desc.length > 0 && ![results containsObject:desc] && ![role isEqualToString:(__bridge NSString *)kAXButtonRole]) {
        [results addObject:desc];
    }
    
    NSArray *children = getAXChildren(element);
    for (id child in children) {
        collectTextsRecursive((__bridge AXUIElementRef)child, results, depth + 1);
    }
}

static BOOL dismissBannerElement(AXUIElementRef element, int depth) {
    if (depth > 8) return NO;
    
    // Check if element has cancel action
    CFArrayRef actionNames = NULL;
    if (AXUIElementCopyActionNames(element, &actionNames) == kAXErrorSuccess && actionNames != NULL) {
        NSArray *actions = (__bridge_transfer NSArray *)actionNames;
        if ([actions containsObject:(__bridge NSString *)kAXCancelAction]) {
            AXUIElementPerformAction(element, kAXCancelAction);
            return YES;
        }
    }
    
    NSString *role = getAXAttribute(element, kAXRoleAttribute);
    NSString *desc = getAXAttribute(element, kAXDescriptionAttribute);
    NSString *title = getAXAttribute(element, kAXTitleAttribute);
    
    if ([role isEqualToString:(__bridge NSString *)kAXButtonRole]) {
        NSString *lowerDesc = [desc lowercaseString] ?: @"";
        NSString *lowerTitle = [title lowercaseString] ?: @"";
        BOOL isClose = [lowerDesc containsString:@"close"] ||
                       [lowerDesc containsString:@"dismiss"] ||
                       [lowerDesc containsString:@"đóng"] ||
                       [lowerTitle containsString:@"close"] ||
                       [lowerTitle isEqualToString:@"✕"] ||
                       [lowerTitle isEqualToString:@"×"] ||
                       [lowerTitle isEqualToString:@"x"];
        if (isClose) {
            AXUIElementPerformAction(element, kAXPressAction);
            return YES;
        }
    }
    
    NSArray *children = getAXChildren(element);
    for (id child in children) {
        if (dismissBannerElement((__bridge AXUIElementRef)child, depth + 1)) {
            return YES;
        }
    }
    return NO;
}

// MARK: - Observer & Window Handling
static NSMutableSet<NSNumber *> *processedWindowHashes = nil;
static NSMutableSet<NSNumber *> *observedPids = nil;

static void handleNewWindow(AXUIElementRef window) {
    if (!processedWindowHashes) {
        processedWindowHashes = [NSMutableSet set];
    }
    
    CFHashCode hash = CFHash(window);
    NSNumber *hashNum = @(hash);
    if ([processedWindowHashes containsObject:hashNum]) {
        return;
    }
    [processedWindowHashes addObject:hashNum];
    
    // Give macOS ~40ms to populate text elements
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(40 * NSEC_PER_MSEC)), dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        NSMutableArray<NSString *> *texts = [NSMutableArray array];
        collectTextsRecursive(window, texts, 0);
        
        if (texts.count == 0) return;
        
        NSString *appName = texts.count > 0 ? texts[0] : @"Notification";
        NSString *title = texts.count > 1 ? texts[1] : (texts.count > 0 ? texts[0] : @"");
        NSString *body = @"";
        if (texts.count > 2) {
            NSArray *bodySlice = [texts subarrayWithRange:NSMakeRange(2, texts.count - 2)];
            body = [bodySlice componentsJoinedByString:@"\n"];
        }
        
        long long nowMs = (long long)([[NSDate date] timeIntervalSince1970] * 1000.0);
        NSString *notifId = [NSString stringWithFormat:@"ax_%lld_%lu", nowMs, (unsigned long)hash];
        
        // Dismiss native banner so user is NOT duplicated!
        BOOL dismissed = dismissBannerElement(window, 0);
        
        emitJSON(@{
            @"type": @"notification",
            @"id": notifId,
            @"appName": appName,
            @"title": title,
            @"body": body,
            @"dismissedNative": @(dismissed),
            @"timestamp": @(nowMs)
        });
    });
}

static void axCallback(AXObserverRef observer, AXUIElementRef element, CFStringRef notification, void *refcon) {
    NSString *notifName = (__bridge NSString *)notification;
    if ([notifName isEqualToString:(__bridge NSString *)kAXWindowCreatedNotification]) {
        handleNewWindow(element);
    }
}

static void setupObserverForApp(NSRunningApplication *app) {
    if (!observedPids) {
        observedPids = [NSMutableSet set];
    }
    pid_t pid = [app processIdentifier];
    NSNumber *pidNum = @(pid);
    if ([observedPids containsObject:pidNum]) return;
    
    AXUIElementRef axApp = AXUIElementCreateApplication(pid);
    AXObserverRef observer = NULL;
    AXError err = AXObserverCreate(pid, axCallback, &observer);
    if (err == kAXErrorSuccess && observer != NULL) {
        AXObserverAddNotification(observer, axApp, kAXWindowCreatedNotification, NULL);
        CFRunLoopAddSource(CFRunLoopGetCurrent(), AXObserverGetRunLoopSource(observer), kCFRunLoopDefaultMode);
        [observedPids addObject:pidNum];
        emitJSON(@{
            @"type": @"status",
            @"listening": @YES,
            @"pid": @(pid),
            @"bundle": [app bundleIdentifier] ?: @""
        });
    } else {
        emitJSON(@{
            @"type": @"log",
            @"message": [NSString stringWithFormat:@"Failed to create AXObserver for pid %d: error %d", pid, err]
        });
    }
    CFRelease(axApp);
}

static void findNotificationCenter(void) {
    NSArray<NSRunningApplication *> *apps = [NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.apple.notificationcenterui"];
    for (NSRunningApplication *app in apps) {
        setupObserverForApp(app);
    }
    if (apps.count == 0) {
        for (NSRunningApplication *app in [[NSWorkspace sharedWorkspace] runningApplications]) {
            NSString *name = [[app localizedName] lowercaseString];
            if ([name containsString:@"notificationcenter"]) {
                setupObserverForApp(app);
            }
        }
    }
}

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        Boolean trusted = AXIsProcessTrusted();
        emitJSON(@{
            @"type": @"status",
            @"trusted": @(trusted),
            @"os": @"darwin"
        });
        
        if (!trusted) {
            NSDictionary *options = @{(__bridge id)kAXTrustedCheckOptionPrompt: @YES};
            AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
        }
        
        findNotificationCenter();
        
        // Background loop to poll for NotificationCenter process restarts
        [NSTimer scheduledTimerWithTimeInterval:5.0 repeats:YES block:^(NSTimer * _Nonnull timer) {
            findNotificationCenter();
            if (processedWindowHashes.count > 300) {
                [processedWindowHashes removeAllObjects];
            }
        }];
        
        // Handle commands from stdin
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_LOW, 0), ^{
            char buffer[2048];
            while (fgets(buffer, sizeof(buffer), stdin) != NULL) {
                NSString *line = [[NSString alloc] initWithUTF8String:buffer];
                if (!line) continue;
                NSData *data = [line dataUsingEncoding:NSUTF8StringEncoding];
                if (!data) continue;
                NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
                if (![json isKindOfClass:[NSDictionary class]]) continue;
                
                NSString *action = json[@"action"];
                if ([action isEqualToString:@"ping"]) {
                    emitJSON(@{@"type": @"pong", @"trusted": @(AXIsProcessTrusted())});
                } else if ([action isEqualToString:@"check"]) {
                    emitJSON(@{@"type": @"status", @"trusted": @(AXIsProcessTrusted())});
                } else if ([action isEqualToString:@"quit"]) {
                    exit(0);
                }
            }
        });
        
        [[NSRunLoop currentRunLoop] run];
    }
    return 0;
}
