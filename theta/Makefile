PKG_CONFIG_LIB = gstreamer-app-1.0 libuvc

CFLAGS += $(shell pkg-config --cflags $(PKG_CONFIG_LIB))
LDFLAGS += $(shell pkg-config --libs $(PKG_CONFIG_LIB))

SRCS = gst_viewer.c thetauvc.c
OBJS := $(SRCS:.c=.o)
EXES = gst_viewer

all: $(EXES)

gst_viewer: $(OBJS)
	$(CC) $(OBJS) -o $@  $(LDFLAGS) -pthread

clean:
	@$(RM) $(OBJS) $(EXES)
