using System;
using System.IO;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Windows.UI.Notifications;
using Windows.UI.Notifications.Management;

namespace CutePetCompanion.Native
{
    class Program
    {
        static void EmitJson(string json)
        {
            Console.WriteLine(json);
            Console.Out.Flush();
        }

        static void Main(string[] args)
        {
            try
            {
                var listener = UserNotificationListener.Current;
                if (listener == null)
                {
                    EmitJson("{\"type\":\"error\",\"message\":\"UserNotificationListener not available.\"}");
                    return;
                }

                var status = listener.GetAccessStatus();
                EmitJson($"{{\"type\":\"status\",\"status\":\"{status}\",\"os\":\"win32\"}}");

                if (status != UserNotificationListenerAccessStatus.Allowed)
                {
                    var reqTask = listener.RequestAccessAsync().AsTask();
                    reqTask.Wait(3000);
                    status = reqTask.Result;
                    EmitJson($"{{\"type\":\"status\",\"status\":\"{status}\",\"requested\":true}}");
                }

                var processedIds = new HashSet<uint>();

                // Pre-populate with existing notifications
                try
                {
                    var existing = listener.GetNotificationsAsync(NotificationKinds.Toast).AsTask().Result;
                    foreach (var n in existing)
                    {
                        processedIds.Add(n.Id);
                    }
                    EmitJson($"{{\"type\":\"ready\",\"initialCount\":{existing.Count}}}");
                }
                catch { }

                // Start stdin listener
                var cts = new CancellationTokenSource();
                Task.Run(() =>
                {
                    string line;
                    while ((line = Console.ReadLine()) != null)
                    {
                        if (line.Contains("\"quit\""))
                        {
                            cts.Cancel();
                            break;
                        }
                        else if (line.Contains("\"ping\""))
                        {
                            EmitJson($"{{\"type\":\"pong\",\"status\":\"{listener.GetAccessStatus()}\"}}");
                        }
                    }
                });

                // Polling loop
                while (!cts.Token.IsCancellationRequested)
                {
                    try
                    {
                        var active = listener.GetNotificationsAsync(NotificationKinds.Toast).AsTask().Result;
                        foreach (var notif in active)
                        {
                            if (!processedIds.Contains(notif.Id))
                            {
                                processedIds.Add(notif.Id);

                                string appName = "Windows";
                                try
                                {
                                    if (notif.AppInfo != null && notif.AppInfo.DisplayInfo != null)
                                    {
                                        appName = notif.AppInfo.DisplayInfo.DisplayName;
                                    }
                                }
                                catch { }

                                string title = "";
                                string body = "";

                                var visual = notif.Notification.Visual;
                                if (visual != null)
                                {
                                    var binding = visual.GetBinding(KnownNotificationBindings.ToastGeneric);
                                    if (binding != null)
                                    {
                                        var elements = binding.GetTextElements();
                                        if (elements.Count > 0) title = elements[0].Text ?? "";
                                        if (elements.Count > 1)
                                        {
                                            var lines = new List<string>();
                                            for (int i = 1; i < elements.Count; i++)
                                            {
                                                if (!string.IsNullOrEmpty(elements[i].Text))
                                                    lines.Add(elements[i].Text);
                                            }
                                            body = string.Join("\n", lines);
                                        }
                                    }
                                }

                                bool dismissed = false;
                                try
                                {
                                    listener.RemoveNotification(notif.Id);
                                    dismissed = true;
                                }
                                catch { }

                                long nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

                                string safeApp = System.Web.HttpUtility.JavaScriptStringEncode(appName);
                                string safeTitle = System.Web.HttpUtility.JavaScriptStringEncode(title);
                                string safeBody = System.Web.HttpUtility.JavaScriptStringEncode(body);

                                EmitJson($"{{\"type\":\"notification\",\"id\":\"win_{notif.Id}\",\"rawId\":{notif.Id},\"appName\":\"{safeApp}\",\"title\":\"{safeTitle}\",\"body\":\"{safeBody}\",\"dismissedNative\":{(dismissed ? "true" : "false")},\"timestamp\":{nowMs}}}");
                            }
                        }

                        if (processedIds.Count > 1000)
                        {
                            processedIds.Clear();
                        }
                    }
                    catch { }

                    Thread.Sleep(250);
                }
            }
            catch (Exception ex)
            {
                EmitJson($"{{\"type\":\"error\",\"message\":{System.Web.HttpUtility.JavaScriptStringEncode(ex.Message)}}}");
            }
        }
    }
}
