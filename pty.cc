#include <fcntl.h>
#include <cstdio>
#include <errno.h>
#include <pty.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char const *[])
{
  int master, slave;
  char name[256];

  // auto e = openpty(&master, &slave, &name[0], nullptr, nullptr);
  // if(0 > e) {
  //   std::printf("Error: %s\n", strerror(errno));
  //   return -1;
  // }

  std::printf("Slave PTY: %s\n", name);
  if (!forkpty(&master, name, 0, 0)) {
	  // close(0);
	  // close(1);
	  // close(2);
	  // dup(slave);
	  // dup(slave);
	  // dup(slave);
	  // close(slave);
	  execlp("/usr/bin/bash", "bash", 0);
  } else {
          char ser[sizeof("-2147483648")]; 
          sprintf(ser, "%d", master);
          execlp("yarn", "yarn", "start", ser,  0);
          printf("at the end: %d", errno);
  }

  return 0;
}
